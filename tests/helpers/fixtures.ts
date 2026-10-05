import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

/** An Upload row for a 20 mm cube (no file needed for uniform-scale pricing). */
export async function cubeUpload() {
  return db.upload.create({
    data: {
      storageKey: `test/${randomUUID()}.stl`,
      originalName: "cube.stl",
      safeName: "cube.stl",
      sizeBytes: 684,
      sha256: "x",
      format: "binary",
      triangleCount: 12,
      volumeMm3: 8000,
      surfaceAreaMm2: 2400,
      bboxX: 20,
      bboxY: 20,
      bboxZ: 20,
      boundaryEdges: 0,
      nonManifold: 0,
    },
  });
}

export const customer = {
  name: "Sam Rivers",
  email: "sam@example.com",
  phone: "604 555 0123",
  notes: "",
  pickupAcknowledged: true,
  termsAccepted: true,
};

export function cartItem(uploadId: string, over: Record<string, unknown> = {}) {
  return { uploadId, unitFactor: 1, scale: { x: 1, y: 1, z: 1 }, material: "PLA", colorId: "orange", quality: "standard", infill: "standard", quantity: 1, ...over };
}

export function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": randomUUID(), ...headers }, body: JSON.stringify(body) });
}

/** A paid order created through the real finalize path (no Square). */
export async function createPaidOrder(over: { notes?: string } = {}) {
  const { priceCart } = await import("@/lib/pricing/server-quote");
  const { finalizeCheckout } = await import("@/lib/orders/finalize");
  const up = await cubeUpload();
  const priced = await priceCart([cartItem(up.id, { quantity: 2 })] as never);
  const { config: _c, ...quote } = priced;
  void _c;
  const checkout = await db.checkout.create({
    data: {
      idempotencyKey: randomUUID(),
      cart: JSON.stringify({ lines: priced.lines, quote }),
      totalCents: priced.totalCents,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      notes: over.notes ?? "Please print it blue side up",
      pickupDate: "2026-10-10",
      pickupTime: "17:00",
    },
  });
  const res = await finalizeCheckout(checkout.id, {
    id: `pay_${randomUUID()}`,
    status: "COMPLETED",
    amountCents: priced.totalCents,
    currency: "CAD",
    receiptUrl: "https://squareup.com/receipt/preview/test",
    cardBrand: "VISA",
    last4: "4242",
  });
  return res!.order;
}

/** The first bookable pickup slot from the real schedule. */
export async function validPickup() {
  const { pickup } = await import("@config/pickup");
  const { availableDays } = await import("@/lib/pickup");
  const day = availableDays(pickup)[0];
  return { date: day.date, time: day.slots[0].time };
}
