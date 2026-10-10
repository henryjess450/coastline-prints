import { describe, expect, it, vi } from "vitest";
import { pngToBitmap } from "@/lib/receipt/bitmap";
import { loadReceiptData, renderReceiptPng } from "@/lib/receipt/render";
import { createPaidOrder } from "../helpers/fixtures";

describe("order receipt", () => {
  it("has the customer, order number and explicit pickup date and time", async () => {
    const order = await createPaidOrder();
    const d = (await loadReceiptData(order.id))!;
    expect(d).toMatchObject({ orderNumber: order.orderNumber, customerName: "Sam Rivers", customerEmail: "sam@example.com", customerPhone: "604 555 0123", pickupDate: "Saturday, October 10, 2026", pickupTime: "5:00 PM to 6:00 PM" });
  });

  it("renders to a 576-dot wide image with ink", async () => {
    const order = await createPaidOrder();
    const png = await renderReceiptPng((await loadReceiptData(order.id))!);
    const bmp = pngToBitmap(png);
    expect(bmp.widthBytes).toBe(72);
    expect(bmp.heightDots).toBeGreaterThan(300);
    expect(bmp.heightDots).toBeLessThan(950); // compact: about 12 cm for a one-item order, invoice QR code included
    expect(bmp.data.some((b) => b !== 0)).toBe(true);
  }, 30_000);

  it("queues a print job with each new order when a printer is configured", async () => {
    vi.stubEnv("RECEIPT_PRINTER_HOST", "10.0.0.137");
    const { db } = await import("@/lib/db");
    const order = await createPaidOrder();
    const job = await db.outboxJob.findUnique({ where: { dedupeKey: `${order.id}:order-receipt` } });
    expect(job?.kind).toBe("print");
    vi.unstubAllEnvs();
  });
});
