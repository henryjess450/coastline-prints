import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PRIZE_DAYS, prizes } from "@config/rewards";
import { generateCode } from "@/lib/codes/server";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { RedeemError } from "./server";

/*
 * Rewards at the LightLab stand (the register and the self-checkout kiosk):
 * find someone by phone number or email, show their points, and trade points
 * for money off this sale. The prize is a one-use coupon added straight to the
 * cart. If the sale never happens, it's undone and the points go back.
 */

/** Notes on stand prizes start with this, so an unused one can be undone. */
const STAND_NOTE = "Rewards prize at the stand for";

/** Last 10 digits, so "+1 (250) 555-0101" and "250-555-0101" match. */
const phoneKey = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-10);

export type StandPrize = { id: string; title: string; points: number; value: string; affordable: boolean };
export type StandProfile = { email: string; name: string; phone: string; hasAccount: boolean; points: number; prizes: StandPrize[] };

/** Dollars-off prizes only: the order-fee one is for print orders, and gift cards are for giving away. */
const standPrizes = prizes.filter((p) => p.kind === "coupon");

/** Someone's rewards by their phone number or email, or null if we've never seen them. */
export async function findRewardsCustomer(query: string): Promise<StandProfile | null> {
  const q = query.trim().toLowerCase();
  let email: string | null = null;
  if (q.includes("@")) email = q;
  else {
    const key = phoneKey(q);
    if (key.length < 7) return null;
    // An account's saved phone wins, then the most recent order with that number.
    const accounts = await db.customer.findMany({ where: { phone: { not: null } }, select: { email: true, phone: true } });
    email = accounts.find((a) => phoneKey(a.phone) === key)?.email ?? null;
    if (!email) {
      const orders = await db.order.findMany({ where: { customerPhone: { not: "" } }, orderBy: { createdAt: "desc" }, select: { customerEmail: true, customerPhone: true } });
      email = orders.find((o) => phoneKey(o.customerPhone) === key)?.customerEmail.toLowerCase() ?? null;
    }
  }
  if (!email) return null;

  const [account, lastOrder, sum] = await Promise.all([
    db.customer.findUnique({ where: { email } }),
    db.order.findFirst({ where: { customerEmail: email }, orderBy: { createdAt: "desc" }, select: { customerName: true, customerPhone: true } }),
    db.pointsEntry.aggregate({ where: { email }, _sum: { points: true } }),
  ]);
  if (!account && !lastOrder && sum._sum.points == null) return null;
  const points = sum._sum.points ?? 0;
  return {
    email,
    name: account?.name || lastOrder?.customerName || "",
    phone: account?.phone || lastOrder?.customerPhone || "",
    hasAccount: !!account,
    points,
    prizes: standPrizes.map((p) => ({ id: p.id, title: p.title, points: p.points, value: money(p.valueCents ?? 0), affordable: points >= p.points })),
  };
}

/*
 * A found customer's email stays on the server: the kiosk gets a short-lived
 * signed ref to send back with the sale, and only sees the email partly hidden.
 * The key is per process, so a restart just means typing the email.
 */
const refKey = randomBytes(32);
const REF_MS = 30 * 60_000;
const sign = (body: string) => createHmac("sha256", refKey).update(body).digest("base64url");

export function rewardsRef(email: string, now = Date.now()) {
  const body = Buffer.from(`${email}|${now + REF_MS}`).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function emailFromRef(ref: string | null | undefined, now = Date.now()): string | null {
  const [body, sig] = (ref ?? "").split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const [email, exp] = Buffer.from(body, "base64url").toString().split("|");
  return email && Number(exp) > now ? email : null;
}

/** "sam.rivera@example.com" → "s•••@example.com". */
export const maskEmail = (email: string) => {
  const [user, domain] = email.split("@");
  return `${user?.[0] ?? ""}•••@${domain ?? ""}`;
};

/** One redemption per email at a time, so two quick taps can't spend the same points twice. */
const busy = new Set<string>();

/** Trades points for a one-use coupon to add to this sale. */
export async function redeemForSale(email: string, prizeId: string, now = new Date()) {
  const prize = standPrizes.find((p) => p.id === prizeId);
  if (!prize) throw new RedeemError("That prize can't be used here.");
  if (busy.has(email)) throw new RedeemError("Hang on, the last one is still being made.");
  busy.add(email);
  try {
    return await db.$transaction(async (tx) => {
      const balance = (await tx.pointsEntry.aggregate({ where: { email }, _sum: { points: true } }))._sum.points ?? 0;
      if (balance < prize.points) throw new RedeemError(`That needs ${prize.points - balance} more points.`);
      let code = generateCode("AMOUNT");
      for (let i = 0; i < 5 && (await tx.promoCode.findUnique({ where: { code } })); i++) code = generateCode("AMOUNT");
      const made = await tx.promoCode.create({
        data: { code, kind: "AMOUNT", amountCents: prize.valueCents ?? 0, maxUses: 1, expiresAt: new Date(now.getTime() + PRIZE_DAYS * 86_400_000), note: `${STAND_NOTE} ${email}` },
      });
      await tx.pointsEntry.create({ data: { email, points: -prize.points, kind: "REDEEM", prizeId: prize.id, codeId: made.id } });
      return { code: made.code, label: prize.title, balance: balance - prize.points };
    });
  } finally {
    busy.delete(email);
  }
}

/** The sale was abandoned: an unused stand prize is deleted and its points go back. */
export async function undoStandRedeem(code: string) {
  const row = await db.promoCode.findUnique({ where: { code } });
  if (!row || row.uses > 0 || !row.note?.startsWith(STAND_NOTE)) return false;
  await db.$transaction([db.pointsEntry.deleteMany({ where: { codeId: row.id, kind: "REDEEM" } }), db.promoCode.delete({ where: { id: row.id } })]);
  return true;
}
