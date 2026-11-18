/** Deal of the day at the stand: comes off at the register and kiosk, only today, never online. */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const { db } = await import("@/lib/db");
const { pricePos } = await import("@/lib/pos/price.server");
const { shopToday } = await import("@/lib/shop/markets.server");
const { listProducts } = await import("@/lib/shop/products.server");

const lamp = (deal: { standDealCents: number; standDealDate: string } | null) =>
  db.shopProduct.create({ data: { slug: `lamp-${randomUUID().slice(0, 8)}`, name: `Deal Lamp ${randomUUID().slice(0, 4)}`, priceCents: 6500, stock: null, variants: "[]", images: "[]", active: true, ...(deal ?? {}) } });

describe("today's deal", () => {
  it("takes the deal off each lamp as its own line", async () => {
    const p = await lamp({ standDealCents: 1000, standDealDate: shopToday() });
    const q = await pricePos({ brand: "lightlab", products: [{ productId: p.id, quantity: 2 }] });
    expect(q.totalCents).toBe(11000);
    expect(q.discountCents).toBe(2000);
    expect(q.discounts[0]).toEqual({ label: `Today's deal: ${p.name}`, cents: 2000 });
    expect((await listProducts({ shop: "lightlab" })).find((x) => x.id === p.id)?.standDealCents).toBe(1000);
  });
  it("is gone the next day", async () => {
    const p = await lamp({ standDealCents: 1000, standDealDate: "2020-01-01" });
    const q = await pricePos({ brand: "lightlab", products: [{ productId: p.id, quantity: 1 }] });
    expect(q.totalCents).toBe(6500);
    expect(q.discounts).toEqual([]);
    expect((await listProducts({ shop: "lightlab" })).find((x) => x.id === p.id)?.standDealCents).toBeNull();
  });
});
