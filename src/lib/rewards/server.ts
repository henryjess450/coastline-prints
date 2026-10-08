import "server-only";
import { POINTS_PER_DOLLAR, PRIZE_DAYS, prizes } from "@config/rewards";
import type { Order, Prisma } from "@/generated/prisma/client";
import { formatCardNumber } from "@/lib/codes/apply";
import { generateCode, generatePin } from "@/lib/codes/server";
import { getEffectiveConfig } from "@/lib/config/effective";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

/** Points for an amount spent: 2 per dollar, rounded down ($19.99 → 39). */
export const pointsFor = (cents: number) => Math.floor((Math.max(0, cents) * POINTS_PER_DOLLAR) / 100);
/** What an order counts as spent: card payment plus any gift card, after coupons. */
/** What the prints cost: shipping is passed on at cost, so it earns no points. */
export const orderSpend = (o: Pick<Order, "totalCents" | "giftCardCents" | "shippingCents">) => Math.max(0, o.totalCents + o.giftCardCents - o.shippingCents);

/** Adds an order's points when it's picked up. Runs inside the status change; once per order. */
export async function earnPoints(tx: Prisma.TransactionClient, order: Order) {
  if (await tx.pointsEntry.findUnique({ where: { orderId: order.id } })) return null;
  const points = pointsFor(orderSpend(order));
  if (points <= 0) return null;
  return tx.pointsEntry.create({ data: { email: order.customerEmail.toLowerCase(), points, kind: "EARN", orderId: order.id } });
}

/** Balance, points still on their way (orders not picked up yet), and recent history. */
export async function rewardsSummary(email: string) {
  const [sum, entries, open] = await Promise.all([
    db.pointsEntry.aggregate({ where: { email }, _sum: { points: true } }),
    db.pointsEntry.findMany({ where: { email }, orderBy: { createdAt: "desc" }, take: 25 }),
    db.order.findMany({ where: { customerEmail: email, status: { not: "PICKED_UP" } }, select: { totalCents: true, giftCardCents: true, shippingCents: true } }),
  ]);
  const orderNumbers = new Map(
    (await db.order.findMany({ where: { id: { in: entries.map((e) => e.orderId).filter(Boolean) as string[] } }, select: { id: true, orderNumber: true } })).map((o) => [o.id, o.orderNumber]),
  );
  return {
    balance: sum._sum.points ?? 0,
    pending: open.reduce((n, o) => n + pointsFor(orderSpend(o)), 0),
    history: entries.map((e) => ({
      id: e.id,
      points: e.points,
      label: e.kind === "EARN" ? `Order ${orderNumbers.get(e.orderId ?? "") ?? ""}`.trim() : (prizes.find((p) => p.id === e.prizeId)?.title ?? "Prize"),
      date: e.createdAt.toISOString(),
    })),
  };
}

export class RedeemError extends Error {}

/** One redemption per email at a time, so two quick taps can't spend the same points twice. */
const busy = new Set<string>();

/**
 * Trades points for a prize: a one-use coupon locked to their account, or a
 * gift card they can give away. Returns what to show them.
 */
export async function redeemPrize(customer: { id: string; email: string }, prizeId: string, now = new Date()) {
  const prize = prizes.find((p) => p.id === prizeId);
  if (!prize) throw new RedeemError("That prize doesn't exist.");
  if (busy.has(customer.email)) throw new RedeemError("Hang on, your last prize is still being made.");
  busy.add(customer.email);
  try {
    const valueCents = prize.kind === "order-fee" ? (await getEffectiveConfig()).pricing.baseFeeCents : (prize.valueCents ?? 0);
    return await db.$transaction(async (tx) => {
      const balance = (await tx.pointsEntry.aggregate({ where: { email: customer.email }, _sum: { points: true } }))._sum.points ?? 0;
      if (balance < prize.points) throw new RedeemError(`You need ${prize.points - balance} more points for that one.`);
      const gift = prize.kind === "gift-card";
      let code = generateCode(gift ? "GIFT_CARD" : "AMOUNT");
      for (let i = 0; i < 5 && (await tx.promoCode.findUnique({ where: { code } })); i++) code = generateCode(gift ? "GIFT_CARD" : "AMOUNT");
      const made = await tx.promoCode.create({
        data: gift
          ? { code, kind: "GIFT_CARD", pin: generatePin(), initialCents: valueCents, balanceCents: valueCents, note: `Rewards prize for ${customer.email}` }
          : {
              code,
              kind: "AMOUNT",
              amountCents: valueCents,
              maxUses: 1,
              expiresAt: new Date(now.getTime() + PRIZE_DAYS * 86_400_000),
              note: `Rewards prize for ${customer.email}`,
              ownerId: customer.id,
              savedAt: now,
            },
      });
      await tx.pointsEntry.create({ data: { email: customer.email, points: -prize.points, kind: "REDEEM", prizeId: prize.id, codeId: made.id } });
      return {
        prize: prize.title,
        kind: prize.kind,
        value: money(valueCents),
        number: formatCardNumber(made.code),
        pin: made.pin,
        balance: balance - prize.points,
      };
    });
  } finally {
    busy.delete(customer.email);
  }
}
