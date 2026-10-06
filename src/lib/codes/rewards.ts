import "server-only";
import type { Order, Prisma } from "@/generated/prisma/client";
import { generateCode } from "./server";

/** Days a first-order thank-you coupon can be used for. */
export const REWARD_DAYS = 90;

/**
 * The thank-you amount for a first order, by what it cost (card plus any gift
 * card, before coupons): under $25 → $3, $25 to $75 → $5, $75 to $150 → $10,
 * over $150 → $20.
 */
export function rewardAmountCents(spentCents: number) {
  if (spentCents < 2500) return 300;
  if (spentCents < 7500) return 500;
  if (spentCents <= 15000) return 1000;
  return 2000;
}

/**
 * Makes the one-use thank-you coupon for a first order and queues its email.
 * Runs inside the status-change transaction. If the customer already has an
 * account, the coupon goes straight into it. Does nothing if it already exists.
 */
export async function createFirstOrderReward(tx: Prisma.TransactionClient, order: Order, now = new Date()) {
  if (order.customerOrderCount !== 1) return null;
  if (await tx.promoCode.findUnique({ where: { rewardOrderId: order.id } })) return null;
  const account = await tx.customer.findUnique({ where: { email: order.customerEmail.toLowerCase() } });
  const amountCents = rewardAmountCents(order.totalCents + order.giftCardCents);

  // A fresh random 12-digit number; try again in the unlikely case it's taken.
  let code = generateCode("AMOUNT");
  for (let i = 0; i < 5 && (await tx.promoCode.findUnique({ where: { code } })); i++) code = generateCode("AMOUNT");

  const coupon = await tx.promoCode.create({
    data: {
      code,
      kind: "AMOUNT",
      amountCents,
      maxUses: 1,
      expiresAt: new Date(now.getTime() + REWARD_DAYS * 86_400_000),
      rewardOrderId: order.id,
      note: `First-order thank-you for ${order.orderNumber}`,
      ownerId: account?.id ?? null,
      savedAt: account ? now : null,
    },
  });
  await tx.outboxJob.create({
    data: { kind: "email", template: "first-order-coupon", payload: JSON.stringify({ orderId: order.id, codeId: coupon.id }), dedupeKey: `${order.id}:first-order-coupon` },
  });
  return coupon;
}
