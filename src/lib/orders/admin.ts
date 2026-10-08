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
export async function changeOrderStatus(orderId: string, to: string, opts: { notify?: boolean; note?: string | null; trackingNumber?: string | null } = {}) {
  if (!ORDER_STATUSES.some((s) => s.id === to)) throw new StatusChangeError(`Unknown status ${to}`);
  const status = to as OrderStatus;
  const note = opts.note?.trim().slice(0, 1000) || null;

  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new StatusChangeError("Order not found");
    if (order.status === status) throw new StatusChangeError("The order already has that status.");

    const ready = status === "READY_FOR_PICKUP";
    // Picked up is the end of the line; no need to email about it unless asked.
    const notify = ready || !!opts.notify;

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
