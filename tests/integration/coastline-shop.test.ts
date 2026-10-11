/**
 * The Coastline shop (ready-made prints at /shop) through the normal
 * checkout, with Square faked: personalised products, CP- order numbers,
 * Coastline branding, and never mixed with LightLab in one cart.
 */
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { customer, jsonRequest, validPickup } from "../helpers/fixtures";

const square = {
  payments: { create: vi.fn(), get: vi.fn() },
  customers: {
    search: vi.fn(async () => ({ customers: [] })),
    create: vi.fn(async () => ({ customer: { id: "SQCUST1" } })),
    get: vi.fn(async ({ customerId }: { customerId: string }) => ({ customer: { id: customerId } })),
  },
};
vi.mock("@/lib/square/client", () => ({
  getSquare: () => square,
  squareLocationId: () => "TEST_LOCATION",
  squarePublicConfig: () => ({ applicationId: "app", locationId: "TEST_LOCATION", environment: "sandbox", scriptUrl: "" }),
}));

const { POST: checkout } = await import("@/app/api/checkout/route");
const { POST: shopQuote } = await import("@/app/api/shop/quote/route");
const { db } = await import("@/lib/db");
const { loadReceiptData } = await import("@/lib/receipt/render");
const { loadInvoice } = await import("@/lib/invoice/data");
const { loadOrderEmailData } = await import("@/lib/email/data");
const { buildEmail } = await import("@/lib/email/build");
const { listProducts, productBySlug } = await import("@/lib/shop/products.server");

const keychain = (over: Record<string, unknown> = {}) =>
  db.shopProduct.create({ data: { shop: "coastline", slug: `keychain-${randomUUID().slice(0, 8)}`, name: "Name Keychain", personalize: "Name on the keychain", priceCents: 800, stock: null, ...over } });

async function pay(products: unknown[], expectedTotalCents: number) {
  const body = { attemptId: randomUUID(), sourceId: "cnon:card-nonce-ok", customer, products, expectedTotalCents, fulfillment: await validPickup() };
  const res = await checkout(jsonRequest("http://test/api/checkout", body));
  return { res, data: await res.json() };
}

beforeEach(() => {
  square.payments.create.mockReset();
  square.payments.create.mockImplementation(async (req) => ({
    payment: { id: `pay_${req.idempotencyKey.slice(0, 8)}`, status: "COMPLETED", amountMoney: req.amountMoney, locationId: "TEST_LOCATION", referenceId: req.referenceId, cardDetails: { card: { cardBrand: "VISA", last4: "1111" } } },
  }));
});

describe("Coastline shop", () => {
  it("keeps its products apart from LightLab's", async () => {
    const k = await keychain();
    expect((await listProducts({ shop: "coastline" })).some((p) => p.id === k.id)).toBe(true);
    expect((await listProducts()).some((p) => p.id === k.id)).toBe(false);
    expect(await productBySlug(k.slug)).toBeNull();
    expect((await productBySlug(k.slug, "coastline"))?.personalize).toBe("Name on the keychain");
  });

  it("needs the personalisation text before it can be bought", async () => {
    const k = await keychain();
    const res = await shopQuote(jsonRequest("http://test/api/shop/quote", { products: [{ productId: k.id, variantId: null, quantity: 1 }] }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("Name on the keychain");
  });

  it("checks out as a CP- order with each name on its own line, branded Coastline", async () => {
    const k = await keychain();
    const { res, data } = await pay(
      [
        { productId: k.id, variantId: null, quantity: 1, customText: "Ava" },
        { productId: k.id, variantId: null, quantity: 2, customText: "Theo" },
      ],
      2400,
    );
    expect(res.status).toBe(200);
    const order = await db.order.findUniqueOrThrow({ where: { orderNumber: data.orderNumber }, include: { items: true } });
    expect(order.orderNumber).toMatch(/^CP-/);
    expect(order.baseFeeCents).toBe(0);
    expect(order.items.map((i) => i.fileName).sort()).toEqual(['Name Keychain: "Ava"', 'Name Keychain: "Theo"']);
    expect(order.items[0]).toMatchObject({ material: "Ready-made", printerId: "coastline-shop" });

    expect((await loadReceiptData(order.id))!.brand).toBe("coastline");
    expect((await loadInvoice({ id: order.id }))!.brand).toBe("coastline");
    const mail = await buildEmail("customer-receipt", (await loadOrderEmailData(order.id))!);
    expect(mail.subject).toContain("Coastline Prints");
    expect(mail.html).not.toContain("queue them on the right printer");
  });

  it("won't mix the two shops in one cart", async () => {
    const k = await keychain();
    const lamp = await db.shopProduct.create({ data: { slug: `lamp-${randomUUID().slice(0, 8)}`, name: "Lamp", priceCents: 4500 } });
    const { res } = await pay(
      [
        { productId: k.id, variantId: null, quantity: 1, customText: "Ava" },
        { productId: lamp.id, variantId: null, quantity: 1 },
      ],
      5300,
    );
    expect(res.status).toBe(422);
    expect(square.payments.create).not.toHaveBeenCalled();
  });
});
