import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { render, toPlainText } from "@react-email/render";
import { legal } from "@config/site";
import { AccountInvite } from "@/emails/AccountInvite";
import { BroadcastEmail } from "@/emails/Broadcast";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import type { OutgoingEmail } from "@/lib/email/transport";

/**
 * Emails to customers that aren't about an order: news and coupon campaigns
 * (only to people who haven't opted out, each with an unsubscribe link), and
 * the "your account is ready" invite. Sent through the outbox, one job per
 * person, so a mail hiccup retries just that one.
 */

const sign = (customerId: string) => createHmac("sha256", `coastline-unsubscribe:${process.env.AUTH_SECRET ?? ""}`).update(customerId).digest("base64url").slice(0, 24);

export function unsubscribeUrl(customerId: string) {
  return `${appUrl()}/unsubscribe?c=${encodeURIComponent(customerId)}&t=${sign(customerId)}`;
}

export function unsubscribeTokenOk(customerId: string, token: string) {
  const a = Buffer.from(sign(customerId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type BroadcastInput = { subject: string; heading: string; body: string; linkUrl?: string | null; linkLabel?: string | null; code?: string | null };

/** Who a broadcast goes to: accounts that haven't unsubscribed. */
export const broadcastAudience = () => db.customer.findMany({ where: { emailOptOut: false }, select: { id: true } });

/** Saves the broadcast and queues one email per customer. Returns how many it's going to. */
export async function queueBroadcast(input: BroadcastInput) {
  const people = await broadcastAudience();
  const b = await db.broadcast.create({ data: { ...input, sentCount: people.length } });
  if (people.length) {
    await db.outboxJob.createMany({
      data: people.map((p) => ({ kind: "email", template: "broadcast", payload: JSON.stringify({ orderId: "", broadcastId: b.id, customerId: p.id }), dedupeKey: `broadcast:${b.id}:${p.id}` })),
    });
  }
  return { id: b.id, count: people.length };
}

/** One customer's copy. Null if they've unsubscribed since it was queued (then it's skipped). */
export async function buildBroadcastEmail(broadcastId: string, customerId: string): Promise<OutgoingEmail | null> {
  const [b, c] = await Promise.all([db.broadcast.findUnique({ where: { id: broadcastId } }), db.customer.findUnique({ where: { id: customerId } })]);
  if (!b || !c || c.emailOptOut) return null;
  const html = await render(<BroadcastEmail heading={b.heading} body={b.body} linkUrl={b.linkUrl} linkLabel={b.linkLabel} code={b.code} unsubscribeUrl={unsubscribeUrl(c.id)} mailingAddress={legal.mailingAddress} />);
  return { to: c.email, subject: b.subject, html, text: toPlainText(html) };
}

export async function buildInviteEmail(customerId: string, note?: string | null): Promise<OutgoingEmail | null> {
  const c = await db.customer.findUnique({ where: { id: customerId } });
  if (!c) return null;
  const html = await render(<AccountInvite name={c.name} signInUrl={`${appUrl()}/account`} note={note} />);
  return { to: c.email, subject: "Your Coastline Prints account is ready", html, text: toPlainText(html) };
}
