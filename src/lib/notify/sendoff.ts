import "server-only";
import { db } from "@/lib/db";

/**
 * Receipts, owner emails and the printed ticket wait for the send-off
 * animation: they're queued with this hold, and the browser releases them
 * when the Benchy has sailed off. If it never does (tab closed, phone died),
 * they go out on their own once the hold runs out, so nothing is ever lost.
 */
export const SENDOFF_HOLD_MS = 3 * 60_000;

export const sendOffHold = (now = new Date()) => new Date(now.getTime() + SENDOFF_HOLD_MS);

/**
 * Sends everything still held for an order or gift purchase right away.
 * Only touches jobs due within the hold window, so a gift scheduled for a
 * later day keeps its date. Returns how many were released.
 */
export async function releaseSendOff(id: string, now = new Date()) {
  const { count } = await db.outboxJob.updateMany({
    where: { dedupeKey: { startsWith: `${id}:` }, status: "PENDING", nextAttemptAt: { gt: now, lte: new Date(now.getTime() + SENDOFF_HOLD_MS + 60_000) } },
    data: { nextAttemptAt: now },
  });
  return count;
}
