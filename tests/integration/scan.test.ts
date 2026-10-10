/** Scan station, barcodes, and archiving or deleting orders. */
import { describe, expect, it } from "vitest";
import { createPaidOrder } from "../helpers/fixtures";

const { db } = await import("@/lib/db");
const { findScannedOrder, scanOrder, undoScan } = await import("@/lib/orders/scan");
const { changeOrderStatus, deleteOrder, setOrderArchived } = await import("@/lib/orders/admin");
const { orderBarcode } = await import("@/lib/receipt/render");

describe("finding the scanned order", () => {
  it("reads the barcode however it's typed, and the invoice QR link", async () => {
    const o = await createPaidOrder();
    const [, yymm, tail] = o.orderNumber.split("-");
    expect((await findScannedOrder(o.orderNumber))?.id).toBe(o.id);
    expect((await findScannedOrder(` cp${yymm}${tail.toLowerCase()} `))?.id).toBe(o.id);
    expect((await findScannedOrder(`https://coastlineprints.ca/orders/${o.viewToken}/invoice`))?.id).toBe(o.id);
    expect(await findScannedOrder("hello")).toBeNull();
  });

  it("prints a sharp barcode", async () => {
    const b = await orderBarcode("CP-2610-ABCD");
    expect(b.src.startsWith("data:image/png;base64,")).toBe(true);
    expect(b.width).toBeLessThanOrEqual(576);
    expect(b.height).toBeGreaterThan(20);
  });
});

describe("scanning", () => {
  it("moves the order on one step, prints a stub, and ignores a quick double scan", async () => {
    const o = await createPaidOrder();
    const t = Date.now();
    const r = await scanOrder(o.orderNumber, { now: t });
    expect(r).toMatchObject({ ok: true, from: "PAID", to: "QUEUED", toLabel: "Queued" });
    expect(await db.outboxJob.count({ where: { template: "scan-stub", dedupeKey: { startsWith: `${o.id}:stub:` } } })).toBe(1);
    expect(await scanOrder(o.orderNumber, { now: t + 2000 })).toMatchObject({ ok: false, reason: expect.stringMatching(/just scanned/) });
    expect(await scanOrder(o.orderNumber, { now: t + 9000 })).toMatchObject({ ok: true, to: "PRINTING" });
  });

  it("asks for the shipping label for tracked parcels, and saves its number", async () => {
    const o = await createPaidOrder({ ship: true });
    await db.order.update({ where: { id: o.id }, data: { status: "POST_PROCESSING" } });
    const first = await scanOrder(o.orderNumber, { now: 1 });
    expect(first).toMatchObject({ ok: false, needsTracking: { orderId: o.id } });
    expect(await scanOrder(o.orderNumber, { tracking: "7023 2104 5566 7788", now: 2 })).toMatchObject({ ok: true, toLabel: "Shipped", emailed: true });
    expect((await db.order.findUnique({ where: { id: o.id } }))?.trackingNumber).toBe("7023210455667788");
  });

  it("undoes a scan without emailing the customer again", async () => {
    const o = await createPaidOrder();
    await db.order.update({ where: { id: o.id }, data: { status: "READY_FOR_PICKUP" } });
    const r = await scanOrder(o.orderNumber, { now: 10 });
    expect(r).toMatchObject({ ok: true, to: "PICKED_UP" });
    const before = await db.outboxJob.count({ where: { template: "ready-for-pickup", dedupeKey: { startsWith: `${o.id}:` } } });
    expect(await undoScan(o.id, "READY_FOR_PICKUP", "PICKED_UP")).toMatchObject({ ok: true, toLabel: "Ready for pickup" });
    expect(await db.outboxJob.count({ where: { template: "ready-for-pickup", dedupeKey: { startsWith: `${o.id}:` } } })).toBe(before);
    expect((await db.order.findUnique({ where: { id: o.id } }))?.status).toBe("READY_FOR_PICKUP");
  });

  it("leaves archived and finished orders alone", async () => {
    const o = await createPaidOrder();
    await setOrderArchived(o.id, true);
    expect(await scanOrder(o.orderNumber, { now: 20 })).toMatchObject({ ok: false, reason: expect.stringMatching(/archived/) });
    await setOrderArchived(o.id, false);
    await db.order.update({ where: { id: o.id }, data: { status: "PICKED_UP" } });
    expect(await scanOrder(o.orderNumber, { now: 30 })).toMatchObject({ ok: false, reason: expect.stringMatching(/Nothing left/) });
  });
});

describe("archiving and deleting", () => {
  it("only deletes an archived order, with its number typed, and drops its waiting jobs", async () => {
    const o = await createPaidOrder({ held: true });
    await expect(deleteOrder(o.id, o.orderNumber)).rejects.toThrow(/Archive the order first/);
    await setOrderArchived(o.id, true);
    await expect(deleteOrder(o.id, "CP-0000-NOPE")).rejects.toThrow(/to confirm/);
    expect(await db.outboxJob.count({ where: { dedupeKey: { startsWith: `${o.id}:` }, status: "PENDING" } })).toBeGreaterThan(0);
    await deleteOrder(o.id, o.orderNumber.toLowerCase());
    expect(await db.order.findUnique({ where: { id: o.id } })).toBeNull();
    expect(await db.orderItem.count({ where: { orderId: o.id } })).toBe(0);
    expect(await db.outboxJob.count({ where: { dedupeKey: { startsWith: `${o.id}:` }, status: "PENDING" } })).toBe(0);
  });

  it("keeps archived orders off the boards", async () => {
    const { adminCards } = await import("@/lib/admin/cards");
    const o = await createPaidOrder();
    await setOrderArchived(o.id, true);
    expect((await adminCards({ id: o.id })).length).toBe(0);
    await setOrderArchived(o.id, false);
    expect((await adminCards({ id: o.id })).length).toBe(1);
    await changeOrderStatus(o.id, "QUEUED");
  });
});
