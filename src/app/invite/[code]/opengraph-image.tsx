import { invite } from "@config/rewards";
import { profileFor } from "@/lib/account/profile";
import { normalizeCode } from "@/lib/codes/apply";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { SHARE_SIZE, shareCard } from "@/lib/og/share-card";

export const runtime = "nodejs";
export const alt = "An invite to Coastline Prints";
export const size = SHARE_SIZE;
export const contentType = "image/png";

/** An invite link's preview says who sent it and what it's worth (a saved first name only, never the email). */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode(decodeURIComponent((await params).code)).slice(0, 40);
  const row = await db.promoCode.findUnique({ where: { code }, include: { referrer: true } });
  const from = row?.referrer && row.active ? (await profileFor(row.referrer)).name.trim().split(/\s+/)[0] || "A friend" : "A friend";
  const off = invite.friendCents % 100 ? money(invite.friendCents) : `$${invite.friendCents / 100}`;
  return shareCard({ title: `${from} sent you ${off} off your first print` });
}
