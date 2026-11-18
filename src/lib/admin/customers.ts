import "server-only";
import { db } from "@/lib/db";

/** Everyone who has ordered or has an account, by email. */
export type CustomerRow = {
  email: string;
  name: string;
  account: { id: string; invitedAt: Date | null; createdAt: Date; lastSeenAt: Date | null; emailOptOut: boolean } | null;
  orders: number;
  /** Prints, gift cards included, shipping left out. */
  spentCents: number;
  lastOrderAt: Date | null;
  points: number;
};

export async function listCustomers(q = ""): Promise<CustomerRow[]> {
  const [accounts, orders, points, names] = await Promise.all([
    db.customer.findMany({ select: { id: true, email: true, name: true, invitedAt: true, createdAt: true, lastSeenAt: true, emailOptOut: true } }),
    db.order.groupBy({ by: ["customerEmail"], _count: true, _sum: { totalCents: true, giftCardCents: true, shippingCents: true }, _max: { createdAt: true } }),
    db.pointsEntry.groupBy({ by: ["email"], _sum: { points: true } }),
    // The name from their latest order, for people without a saved one.
    db.order.findMany({ orderBy: { createdAt: "desc" }, distinct: ["customerEmail"], select: { customerEmail: true, customerName: true } }),
  ]);
  const rows = new Map<string, CustomerRow>();
  const row = (email: string) => {
    const key = email.toLowerCase();
    let r = rows.get(key);
    if (!r) rows.set(key, (r = { email: key, name: "", account: null, orders: 0, spentCents: 0, lastOrderAt: null, points: 0 }));
    return r;
  };
  for (const n of names) row(n.customerEmail).name ||= n.customerName;
  for (const a of accounts) {
    const r = row(a.email);
    r.account = { id: a.id, invitedAt: a.invitedAt, createdAt: a.createdAt, lastSeenAt: a.lastSeenAt, emailOptOut: a.emailOptOut };
    if (a.name) r.name = a.name;
  }
  for (const o of orders) {
    const r = row(o.customerEmail);
    r.orders += o._count;
    r.spentCents += (o._sum.totalCents ?? 0) + (o._sum.giftCardCents ?? 0) - (o._sum.shippingCents ?? 0);
    if (o._max.createdAt && (!r.lastOrderAt || o._max.createdAt > r.lastOrderAt)) r.lastOrderAt = o._max.createdAt;
  }
  for (const p of points) row(p.email).points = p._sum.points ?? 0;

  const needle = q.trim().toLowerCase();
  return [...rows.values()]
    .filter((r) => !needle || r.email.includes(needle) || r.name.toLowerCase().includes(needle))
    .sort((a, b) => (b.lastOrderAt ?? b.account?.createdAt ?? new Date(0)).getTime() - (a.lastOrderAt ?? a.account?.createdAt ?? new Date(0)).getTime());
}

export class CustomerEditError extends Error {}

/**
 * The owner fixing someone's details. A new email moves their account, points
 * and past orders to it (refused if another account already uses it). Their
 * Square customer is updated in place by the outbox, never duplicated.
 */
export async function updateCustomer(oldEmail: string, input: { email: string; name: string; phone: string; news: boolean }) {
  const email = input.email.trim().toLowerCase();
  const account = await db.customer.findUnique({ where: { email: oldEmail } });
  if (!account) throw new CustomerEditError("They don't have an account to edit.");
  if (email !== oldEmail && (await db.customer.findUnique({ where: { email } }))) throw new CustomerEditError("Another account already uses that email.");
  await db.$transaction([
    db.customer.update({ where: { id: account.id }, data: { email, name: input.name.trim() || null, phone: input.phone.trim() || null, emailOptOut: !input.news } }),
    ...(email !== oldEmail
      ? [
          db.pointsEntry.updateMany({ where: { email: oldEmail }, data: { email } }),
          db.order.updateMany({ where: { customerEmail: oldEmail }, data: { customerEmail: email } }),
          // Old sign-in codes and sessions shouldn't follow the old address.
          db.loginCode.deleteMany({ where: { email: oldEmail } }),
          db.customerSession.deleteMany({ where: { customerId: account.id } }),
        ]
      : []),
  ]);
  return { id: account.id, email };
}

/**
 * Deletes someone's account: sign-ins, saved details and points go; their
 * orders stay for the books. Coupons saved to the account (prizes, comeback
 * coupons) are switched off; gift cards are money and are left working.
 * Their Square customer is left alone.
 */
export async function deleteCustomer(email: string) {
  const account = await db.customer.findUnique({ where: { email } });
  await db.$transaction([
    db.pointsEntry.deleteMany({ where: { email } }),
    db.loginCode.deleteMany({ where: { email } }),
    ...(account
      ? [
          db.promoCode.updateMany({ where: { ownerId: account.id, kind: { not: "GIFT_CARD" } }, data: { expiresAt: new Date() } }),
          db.promoCode.updateMany({ where: { ownerId: account.id }, data: { ownerId: null } }),
          db.promoCode.updateMany({ where: { referrerId: account.id }, data: { referrerId: null, expiresAt: new Date() } }),
          db.customer.delete({ where: { id: account.id } }),
        ]
      : []),
  ]);
}
