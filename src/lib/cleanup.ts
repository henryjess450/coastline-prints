import "server-only";
import { legal } from "@config/site";
import { logError } from "@/lib/api";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

const DAY = 86_400_000;

/**
 * File retention promised in the Privacy Policy:
 * - uploads never used in a paid order: deleted after `abandonedUploadDays`
 * - files of picked-up orders: deleted `fileRetentionDaysAfterPickup` days
 *   after pickup (the order record itself is kept)
 */
export async function cleanupFiles(now = new Date()) {
  const storage = getStorage();
  let abandoned = 0;
  let expired = 0;

  const stale = await db.upload.findMany({
    where: { createdAt: { lt: new Date(now.getTime() - legal.abandonedUploadDays * DAY) }, orderItems: { none: {} } },
    select: { id: true, storageKey: true },
    take: 500,
  });
  for (const u of stale) {
    try {
      await storage.delete(u.storageKey);
      await db.upload.delete({ where: { id: u.id } });
      abandoned++;
    } catch (err) {
      logError("cleanup:abandoned", err);
    }
  }

  // Orders picked up long enough ago: find their pickup event time.
  const cutoff = new Date(now.getTime() - legal.fileRetentionDaysAfterPickup * DAY);
  const pickedUp = await db.orderStatusEvent.findMany({
    where: { toStatus: "PICKED_UP", createdAt: { lt: cutoff }, order: { status: "PICKED_UP" } },
    select: { orderId: true },
    take: 500,
  });
  const orderIds = [...new Set(pickedUp.map((e) => e.orderId))];
  if (orderIds.length) {
    const uploads = await db.upload.findMany({
      where: { fileDeletedAt: null, orderItems: { some: { orderId: { in: orderIds } } } },
      select: { id: true, storageKey: true, orderItems: { select: { order: { select: { status: true } } } } },
    });
    for (const u of uploads) {
      // Keep a file another still-active order uses.
      if (u.orderItems.some((i) => i.order.status !== "PICKED_UP")) continue;
      try {
        await storage.delete(u.storageKey);
        await db.upload.update({ where: { id: u.id }, data: { fileDeletedAt: now } });
        expired++;
      } catch (err) {
        logError("cleanup:expired", err);
      }
    }
  }
  return { abandoned, expired };
}
