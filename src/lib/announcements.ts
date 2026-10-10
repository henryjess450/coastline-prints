import "server-only";
import { db } from "@/lib/db";

export type LiveAnnouncement = { id: string; message: string; linkUrl: string | null; linkLabel: string | null };

let cached: { value: LiveAnnouncement | null; at: number } | null = null;

/** The announcement showing right now (the newest live one), if any. Read on every page, so cached briefly. */
export async function liveAnnouncement(now = new Date()): Promise<LiveAnnouncement | null> {
  if (cached && Date.now() - cached.at < 10_000) return cached.value;
  const a = await db.announcement
    .findFirst({
      where: { active: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
      orderBy: { createdAt: "desc" },
      select: { id: true, message: true, linkUrl: true, linkLabel: true },
    })
    .catch(() => null);
  cached = { value: a, at: Date.now() };
  return a;
}

export function clearAnnouncementCache() {
  cached = null;
}
