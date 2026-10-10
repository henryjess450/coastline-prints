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
