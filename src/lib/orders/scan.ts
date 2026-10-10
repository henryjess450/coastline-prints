import "server-only";
import { db } from "@/lib/db";
import { isTracked } from "@/lib/shipping/address";
import { changeOrderStatus, StatusChangeError } from "./admin";
import { nextStep } from "./next-step";
import { statusInfo } from "./status";

/**
 * The scan station. A USB barcode scanner types what it reads and presses
 * Enter: the order number from the barcode on a ticket, or the invoice link
 * from its QR code. Each scan moves that order to its next step and prints a
 * stub saying so. Tracked parcels ask for the shipping label next, so the
 * tracking number goes in with it.
 */

export type ScanResult =
  | { ok: true; orderId: string; orderNumber: string; customer: string; from: string; fromLabel: string; to: string; toLabel: string; emailed: boolean }
  | { ok: false; reason: string; needsTracking?: { orderId: string; orderNumber: string; customer: string } };

/** "cp-2610-bdfp", "CP2610BDFP", or an /orders/<token> link → the order. */
export async function findScannedOrder(raw: string) {
  const text = raw.trim();
  const link = text.match(/\/orders\/([\w-]{20,64})/);
  if (link) return db.order.findUnique({ where: { viewToken: link[1] } });
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = compact.match(/^CP(\d{4})([A-Z0-9]{4})$/);
  if (!m) return null;
  return db.order.findUnique({ where: { orderNumber: `CP-${m[1]}-${m[2]}` } });
}

/** Last scan per order, so a double scan (or the scanner bouncing) doesn't skip a step. */
const recent = new Map<string, number>();
const REPEAT_MS = 8000;

/** Moves the scanned order on one step. `tracking` is the label scanned after a tracked parcel. */
export async function scanOrder(raw: string, opts: { tracking?: string; now?: number } = {}): Promise<ScanResult> {
  const now = opts.now ?? Date.now();
  const order = await findScannedOrder(raw);
  if (!order) return { ok: false, reason: `No order matches "${raw.trim().slice(0, 40)}".` };
  if (order.archivedAt) return { ok: false, reason: `${order.orderNumber} is archived. Bring it back from the admin first.` };
  const last = recent.get(order.id);
  if (last && now - last < REPEAT_MS) return { ok: false, reason: `${order.orderNumber} was just scanned. Wait a moment to move it again.` };

  const step = nextStep(order.status, order.fulfillment, isTracked(order));
  if (!step) return { ok: false, reason: `${order.orderNumber} is already ${statusInfo(order.status, order.fulfillment).label.toLowerCase()}. Nothing left to do.` };
  if (step.tracking && !opts.tracking) return { ok: false, reason: "Now scan the Canada Post label.", needsTracking: { orderId: order.id, orderNumber: order.orderNumber, customer: order.customerName } };

  try {
    const r = await changeOrderStatus(order.id, step.to, { from: order.status, trackingNumber: opts.tracking ?? null, note: null });
    recent.set(order.id, now);
    await queueStub(order.id, statusInfo(step.to, order.fulfillment).label);
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customer: order.customerName,
      from: order.status,
      fromLabel: statusInfo(order.status, order.fulfillment).label,
      to: step.to,
      toLabel: statusInfo(step.to, order.fulfillment).label,
      emailed: r.notified,
    };
  } catch (err) {
    if (err instanceof StatusChangeError) return { ok: false, reason: err.message };
    throw err;
  }
}

/** Puts the order back where it was before a scan (no email to the customer), and prints a stub saying so. */
export async function undoScan(orderId: string, from: string, to: string): Promise<ScanResult> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, reason: "That order is gone." };
  try {
    await changeOrderStatus(orderId, from, { from: to, note: "Undone at the scan station", silent: true });
    recent.delete(orderId);
    await queueStub(orderId, `${statusInfo(from, order.fulfillment).label} (undone)`);
    return { ok: true, orderId, orderNumber: order.orderNumber, customer: order.customerName, from: to, fromLabel: statusInfo(to, order.fulfillment).label, to: from, toLabel: statusInfo(from, order.fulfillment).label, emailed: false };
  } catch (err) {
    if (err instanceof StatusChangeError) return { ok: false, reason: err.message };
    throw err;
  }
}

/** The little "updated to…" stub, printed with the next print run. */
async function queueStub(orderId: string, statusLabel: string) {
  if (!process.env.RECEIPT_PRINTER_HOST && process.env.NODE_ENV === "production") return;
  await db.outboxJob.create({ data: { kind: "print", template: "scan-stub", payload: JSON.stringify({ orderId, note: statusLabel }), dedupeKey: `${orderId}:stub:${Date.now()}` } });
}
