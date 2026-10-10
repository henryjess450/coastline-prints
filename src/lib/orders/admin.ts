import "server-only";
import { createFirstOrderReward } from "@/lib/codes/rewards";
import { earnPoints } from "@/lib/rewards/server";
import { db } from "@/lib/db";
import { ORDER_STATUSES, type OrderStatus } from "./status";

export class StatusChangeError extends Error {}

/**
 * Moves an order to a new status and records it in the history.
 * READY_FOR_PICKUP always emails the customer: the pickup address for pickup
 * orders, or the tracking number for shipped ones (never the address);
 * other changes email them only when `notify` is true. The email job is
 * queued in the same transaction, so it can't be lost. When a customer's
 * first order is picked up, their thank-you coupon is made here too.
 */
export async function changeOrderStatus(orderId: string, to: string, opts: { notify?: boolean; note?: string | null; trackingNumber?: string | null; from?: string; /** No email at all (undoing a scan). */ silent?: boolean } = {}) {
  if (!ORDER_STATUSES.some((s) => s.id === to)) throw new StatusChangeError(`Unknown status ${to}`);
  const status = to as OrderStatus;
  const note = opts.note?.trim().slice(0, 1000) || null;

  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new StatusChangeError("Order not found");
    if (order.status === status) throw new StatusChangeError("The order already has that status.");
    // One-tap buttons say where the order was; a second tap (or another tab) can't skip a step.
    if (opts.from && order.status !== opts.from) throw new StatusChangeError("This order was already moved on. Refresh to see where it's at.");

    const ready = status === "READY_FOR_PICKUP";
    // Picked up is the end of the line; no need to email about it unless asked.
    const notify = !opts.silent && (ready || !!opts.notify);

    const shipped = ready && order.fulfillment === "SHIP";
    const tracking = opts.trackingNumber?.replace(/\s+/g, "").toUpperCase().slice(0, 40) || null;
    if (tracking && !/^[A-Z0-9]{8,40}$/.test(tracking)) throw new StatusChangeError("That tracking number doesn't look right.");

    await tx.order.update({ where: { id: orderId }, data: { status, ...(shipped && tracking ? { trackingNumber: tracking } : {}) } });
    const event = await tx.orderStatusEvent.create({
      data: { orderId, fromStatus: order.status, toStatus: status, note, customerNotified: notify },
    });
    if (notify) {
      await tx.outboxJob.create({
        data: {
          kind: "email",
          template: shipped ? "shipped" : ready ? "ready-for-pickup" : "status-update",
          payload: JSON.stringify({ orderId, note }),
          dedupeKey: `${orderId}:status:${event.id}`,
        },
      });
    }
    if (status === "PICKED_UP") {
      await createFirstOrderReward(tx, order);
      await earnPoints(tx, order); // Coastline Rewards: 2 points per $1, once the order is collected
    }
    return { from: order.status, to: status, notified: notify };
  });
}

/** Tucks an order away (or brings it back). Archived orders leave the boards and lists; the customer still sees theirs. */
export async function setOrderArchived(orderId: string, archived: boolean) {
  const { count } = await db.order.updateMany({ where: { id: orderId }, data: { archivedAt: archived ? new Date() : null } });
  if (!count) throw new StatusChangeError("Order not found");
}

/**
 * Deletes an order for good: its items and history go with it, and any
 * emails or prints still waiting for it are dropped. Only archived orders,
 * and only when the order number is typed to confirm. The payment record
 * (Square / e-Transfer) and any points or coupons it earned are kept.
 */
export async function deleteOrder(orderId: string, typedNumber: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, archivedAt: true } });
  if (!order) throw new StatusChangeError("Order not found");
  if (!order.archivedAt) throw new StatusChangeError("Archive the order first, then delete it.");
  if (typedNumber.trim().toUpperCase() !== order.orderNumber) throw new StatusChangeError(`Type ${order.orderNumber} to confirm.`);
  await db.$transaction([
    db.outboxJob.deleteMany({ where: { dedupeKey: { startsWith: `${orderId}:` }, status: { not: "SENT" } } }),
    db.order.delete({ where: { id: orderId } }),
  ]);
  return order.orderNumber;
}
