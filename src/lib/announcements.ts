import "server-only";
import { pickup } from "@config/pickup";
import { db } from "@/lib/db";
import { bonusLine, bonusLive } from "@/lib/giftcards/bonus";
import { getGiftBonus } from "@/lib/giftcards/bonus.server";
import { todayIn } from "@/lib/pickup";

/** `coastlineOnly`: hidden on the LightLab pages (it's about Coastline gift cards). */
export type LiveAnnouncement = { id: string; message: string; linkUrl: string | null; linkLabel: string | null; coastlineOnly?: boolean };

let cached: { value: LiveAnnouncement | null; at: number } | null = null;

/**
 * The announcement showing right now (the newest live one), if any. With
 * none set, a running gift card bonus announces itself. Read on every page,
 * so cached briefly.
 */
export async function liveAnnouncement(now = new Date()): Promise<LiveAnnouncement | null> {
  if (cached && Date.now() - cached.at < 10_000) return cached.value;
  const a = await db.announcement
    .findFirst({
      where: { active: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
      orderBy: { createdAt: "desc" },
      select: { id: true, message: true, linkUrl: true, linkLabel: true },
    })
    .catch(() => null);
  const value = a ?? (await giftBonusAnnouncement(now));
  cached = { value, at: Date.now() };
  return value;
}

async function giftBonusAnnouncement(now: Date): Promise<LiveAnnouncement | null> {
  const b = await getGiftBonus().catch(() => null);
  if (!bonusLive(b, todayIn(pickup.timeZone, now))) return null;
  // The id includes the dates, so closing this year's bar doesn't hide next year's.
  return { id: `gift-bonus-${b.startsOn}-${b.endsOn}`, message: `${b.name}: ${bonusLine(b)}.`, linkUrl: "/gift-cards", linkLabel: "Gift cards", coastlineOnly: true };
}

export function clearAnnouncementCache() {
  cached = null;
}
