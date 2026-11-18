/**
 * Register sales that hit trouble: an offline sale is saved at what the
 * customer actually paid, a sale whose first save failed can be sent again,
 * and a sale that's mid-save elsewhere says "try again shortly" instead of
 * being parked as refused.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const { db } = await import("@/lib/db");
const { ringUpSale, PosSaleError } = await import("@/lib/pos/sale.server");

async function lamp(priceCents = 6500) {
  return db.shopProduct.create({
    data: { slug: `lamp-${randomUUID().slice(0, 8)}`, name: "Drop Pendant", priceCents, stock: null, variants: "[]", images: "[]", active: true },
  });
}

const cashSale = (productId: string, over: Record<string, unknown> = {}) => ({
  attemptId: randomUUID(),
  cart: { brand: "lightlab" as const, products: [{ productId, quantity: 1 }] },
  expectedTotalCents: 6500,
  payment: "CASH" as const,
  source: "LightLab market stall",
  customer: { name: "", email: "", phone: "", notes: "" },
  ...over,
});

describe("offline sales", () => {
  it("are saved at the amount taken, not today's price", async () => {
    const p = await lamp(6500);
    // Rung up offline at $60 (an older price); the lamp is $65 now.
    const s = cashSale(p.id, { expectedTotalCents: 6000, tenderedCents: 6000, offline: { at: new Date().toISOString(), totalCents: 6000 } });
    const { order } = await ringUpSale(s);
    expect(order.totalCents).toBe(6000);
    expect(order.discountCents).toBe(500);
    const events = await db.orderStatusEvent.findMany({ where: { orderId: order.id } });
    expect(events.map((e) => e.note).join(" ")).toMatch(/Took \$60\.00 offline; prices now add up to \$65\.00/);
  });
});

describe("sending a sale again", () => {
  it("saves it when the first try failed", async () => {
    const p = await lamp();
    const s = cashSale(p.id);
    await db.checkout.create({ data: { idempotencyKey: s.attemptId, totalCents: 6500, customerName: "", customerEmail: "", customerPhone: "", cart: "{}", status: "FAILED" } });
    const { order } = await ringUpSale(s);
    expect(order.totalCents).toBe(6500);
    // And again: the same order, not a second one.
    expect((await ringUpSale(s)).order.id).toBe(order.id);
  });

  it("asks to try again shortly while another save is still going", async () => {
    const p = await lamp();
    const s = cashSale(p.id);
    await db.checkout.create({ data: { idempotencyKey: s.attemptId, totalCents: 6500, customerName: "", customerEmail: "", customerPhone: "", cart: "{}" } });
    const err = await ringUpSale(s).catch((e) => e);
    expect(err).toBeInstanceOf(PosSaleError);
    expect(err.retry).toBe(true);
  });

  it("treats a save that never finished long ago as failed", async () => {
    const p = await lamp();
    const s = cashSale(p.id);
    await db.checkout.create({ data: { idempotencyKey: s.attemptId, totalCents: 6500, customerName: "", customerEmail: "", customerPhone: "", cart: "{}", createdAt: new Date(Date.now() - 10 * 60_000) } });
    const { order } = await ringUpSale(s);
    expect(order.totalCents).toBe(6500);
  });
});
