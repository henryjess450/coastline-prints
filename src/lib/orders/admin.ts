import "server-only";
import { db } from "@/lib/db";
import { ORDER_STATUSES, type OrderStatus } from "./status";

export class StatusChangeError extends Error {}

/**
 * Moves an order to a new status and records it in the history.
 * READY_FOR_PICKUP always emails the customer (with the pickup address);
 * other changes email them only when `notify` is true. The email job is
 * queued in the same transaction, so it can't be lost.
 */
export async function changeOrderStatus(orderId: string, to: string, opts: { notify?: boolean; note?: string | null } = {}) {
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

    await tx.order.update({ where: { id: orderId }, data: { status } });
    const event = await tx.orderStatusEvent.create({
      data: { orderId, fromStatus: order.status, toStatus: status, note, customerNotified: notify },
    });
    if (notify) {
      await tx.outboxJob.create({
        data: {
          kind: "email",
          template: ready ? "ready-for-pickup" : "status-update",
          payload: JSON.stringify({ orderId, note }),
          dedupeKey: `${orderId}:status:${event.id}`,
        },
      });
    }
    return { from: order.status, to: status, notified: notify };
  });
}
