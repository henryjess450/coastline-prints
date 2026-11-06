import "server-only";
import { normalizeEmail, queueSquareSync } from "@/lib/account/auth";
import { db } from "@/lib/db";
import { sendNotificationsSoon } from "@/lib/notify/kick";

/**
 * "Join LightLab updates" at the stand: puts them on the email list (a
 * customer record that broadcasts go to, with its unsubscribe link), noting
 * when and where they signed up as their consent. No sign-in email is sent.
 * Someone already on the list who'd unsubscribed is opted back in, since
 * they just asked. Returns true when they're new.
 */
export async function joinUpdates(rawEmail: string, name: string | null, source: string | null) {
  const email = normalizeEmail(rawEmail);
  const from = `LightLab updates${source ? ` · ${source}` : ""}`;
  const existing = await db.customer.findUnique({ where: { email } });
  if (existing) {
    await db.customer.update({
      where: { id: existing.id },
      data: { emailOptOut: false, joinedAt: existing.joinedAt ?? new Date(), joinedFrom: existing.joinedFrom ?? from, name: existing.name || name?.trim() || null },
    });
    return false;
  }
  const customer = await db.customer.create({ data: { email, name: name?.trim() || null, joinedAt: new Date(), joinedFrom: from } });
  await queueSquareSync(customer.id);
  sendNotificationsSoon("pos-join");
  return true;
}
