import "server-only";
import { randomBytes } from "node:crypto";
import { invite } from "@config/rewards";
import type { Order, Prisma, PromoCode } from "@/generated/prisma/client";
import type { AppliedCode } from "@/lib/codes/apply";
import { db } from "@/lib/db";

/**
 * Invite a friend. Each account has one invite code (made the first time
 * it's needed). It's an ordinary coupon with no use limit, except it only
 * works on someone's first order and never for the person who shares it.
 * When a friend's first order is paid, the sharer gets their points.
 */

/** "Sam Lee" / "sam.lee@…" → "SAM"; letters only, so it never looks like a coupon or gift card number. */
export function inviteStem(name: string | null, email: string) {
  const fromName = (name ?? "").split(/\s+/)[0] ?? "";
  const letters = (s: string) => s.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase();
  const stem = letters(fromName) || letters(email.split("@")[0]);
  return (stem || "FRIEND").slice(0, 8);
}

/** Two digits and two letters after the name, e.g. "SAM4K7Q". No 0/O or 1/I to mix up. */
function suffix() {
  const digits = "23456789";
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const b = randomBytes(4);
  return `${digits[b[0] % digits.length]}${letters[b[1] % letters.length]}${digits[b[2] % digits.length]}${letters[b[3] % letters.length]}`;
}

/** Their invite code, made on first use. */
export async function inviteCodeFor(customer: { id: string; email: string; name: string | null }) {
  const existing = await db.promoCode.findUnique({ where: { referrerId: customer.id } });
  if (existing) return existing;
  const stem = inviteStem(customer.name, customer.email);
  for (let i = 0; i < 8; i++) {
    const code = `${stem}${suffix()}`;
    if (await db.promoCode.findUnique({ where: { code } })) continue;
    try {
      return await db.promoCode.create({
        data: { code, kind: "AMOUNT", amountCents: invite.friendCents, referrerId: customer.id, note: `Invite code for ${customer.email}` },
      });
    } catch {
      // Made at the same moment in another tab: use that one.
      const raced = await db.promoCode.findUnique({ where: { referrerId: customer.id } });
      if (raced) return raced;
    }
  }
  throw new Error("Could not make an invite code");
}

/**
 * Why an invite code can't be used by this buyer, or null. `customerId` is
 * the signed-in account (if any); `email` is who's ordering (if known yet).
 */
export async function inviteProblem(code: PromoCode, customerId: string | null, email: string | null) {
  if (!code.referrerId) return null;
  const referrer = await db.customer.findUnique({ where: { id: code.referrerId }, select: { id: true, email: true } });
  if (!referrer) return "That code isn't valid.";
  const own = "That's your own invite code. Share it with a friend!";
  if (customerId === referrer.id || (email && email === referrer.email)) return own;
  const buyer = customerId ? await db.customer.findUnique({ where: { id: customerId }, select: { email: true } }) : null;
  const emails = [...new Set([email, buyer?.email].filter(Boolean) as string[])];
  if (emails.length && (await db.order.count({ where: { customerEmail: { in: emails } } })) > 0) return "Invite codes are for a first order.";
  return null;
}

/**
 * The friend's first order is paid: give the person who invited them their
 * points. Runs inside the order's transaction; once per order.
 */
export async function creditInvite(tx: Prisma.TransactionClient, order: Order) {
  if (order.customerOrderCount !== 1) return null;
  const applied = JSON.parse(order.appliedCodes || "[]") as AppliedCode[];
  if (!applied.length) return null;
  const code = await tx.promoCode.findFirst({ where: { code: { in: applied.map((a) => a.code) }, referrerId: { not: null } }, include: { referrer: true } });
  if (!code?.referrer || code.referrer.email === order.customerEmail.toLowerCase()) return null;
  if (await tx.pointsEntry.findUnique({ where: { inviteOrderId: order.id } })) return null;
  return tx.pointsEntry.create({ data: { email: code.referrer.email, points: invite.points, kind: "INVITE", inviteOrderId: order.id } });
}

/** How many friends have ordered with their code, and the points it's earned. */
export async function inviteStats(email: string) {
  const agg = await db.pointsEntry.aggregate({ where: { email, kind: "INVITE" }, _count: true, _sum: { points: true } });
  return { friends: agg._count, points: agg._sum.points ?? 0 };
}
