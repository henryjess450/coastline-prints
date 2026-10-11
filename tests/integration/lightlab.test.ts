/**
 * LightLab shop orders through the normal checkout, with Square faked:
 * server prices, no order fee, stock limits, and stock going down once paid.
 */
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPaidOrder, customer, jsonRequest, validPickup } from "../helpers/fixtures";

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
const { loadReceiptData, renderReceiptPng } = await import("@/lib/receipt/render");
const { invoiceFileName, loadInvoice } = await import("@/lib/invoice/data");
const { renderInvoicePdf } = await import("@/lib/invoice/pdf");
const { loadOrderEmailData } = await import("@/lib/email/data");
const { buildEmail } = await import("@/lib/email/build");
const { findScannedOrder } = await import("@/lib/orders/scan");

async function lamp(over: Record<string, unknown> = {}) {
  return db.shopProduct.create({
    data: {
      slug: `lamp-${randomUUID().slice(0, 8)}`,
      name: "Banana Lamp",
      priceCents: 4500,
      stock: 3,
      variants: JSON.stringify([
        { id: "yellow1", name: "Yellow", priceCents: null, stock: null, hex: "#f5d000" },
        { id: "white01", name: "White", priceCents: 5000, stock: 1, hex: "#ffffff" },
      ]),
      ...over,
    },
  });
}

async function quoteOf(products: unknown[]) {
  const res = await shopQuote(jsonRequest("http://test/api/shop/quote", { products }));
  return { status: res.status, body: await res.json() };
}

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

describe("LightLab shop", () => {
  it("prices from the database with option prices and no order fee", async () => {
    const p = await lamp();
    const { status, body } = await quoteOf([
      { productId: p.id, variantId: "yellow1", quantity: 2 },
      { productId: p.id, variantId: "white01", quantity: 1 },
    ]);
    expect(status).toBe(200);
    expect(body.quote).toMatchObject({ baseFeeCents: 0, minimumAdjCents: 0, totalCents: 4500 * 2 + 5000, ok: true });
    expect(body.quote.shipping).not.toBeNull();
  });

  it("needs an option when the product has them, and refuses more than are in stock", async () => {
    const p = await lamp();
    expect((await quoteOf([{ productId: p.id, variantId: null, quantity: 1 }])).status).toBe(422);
    const tooMany = await quoteOf([{ productId: p.id, variantId: "white01", quantity: 2 }]);
    expect(tooMany.status).toBe(422);
    expect(tooMany.body.error).toMatch(/Only 1/);
    // The same option on two lines counts once against stock.
    expect((await quoteOf([{ productId: p.id, variantId: "yellow1", quantity: 2 }, { productId: p.id, variantId: "yellow1", quantity: 2 }])).status).toBe(422);
  });

  it("hides inactive products from carts", async () => {
    const p = await lamp({ active: false, variants: "[]" });
    expect((await quoteOf([{ productId: p.id, variantId: null, quantity: 1 }])).status).toBe(422);
  });

  it("checks out through the normal checkout and takes the stock off the shelf", async () => {
    const p = await lamp();
    const products = [
      { productId: p.id, variantId: "yellow1", quantity: 2 },
      { productId: p.id, variantId: "white01", quantity: 1 },
    ];
    const { res, data } = await pay(products, 14000);
    expect(res.status).toBe(200);
    expect(data.status).toBe("paid");

    const order = await db.order.findUniqueOrThrow({ where: { orderNumber: data.orderNumber }, include: { items: true } });
    // LightLab orders are numbered LL-, and the scan station finds them like any other.
    expect(order.orderNumber).toMatch(/^LL-\d{4}-[2-9A-Z]{4}$/);
    expect((await findScannedOrder(order.orderNumber.toLowerCase().replace(/-/g, "")))?.id).toBe(order.id);
    expect(order.totalCents).toBe(14000);
    expect(order.baseFeeCents).toBe(0);
    expect(order.items).toHaveLength(2);
    expect(order.items.every((i) => i.productId === p.id && i.uploadId === null)).toBe(true);
    expect(order.items.find((i) => i.variantId === "white01")).toMatchObject({ fileName: "Banana Lamp", colorName: "White", unitCents: 5000, quantity: 1 });

    const after = await db.shopProduct.findUniqueOrThrow({ where: { id: p.id } });
    // Yellow has no count of its own, so it comes off the product's 3; white had its own 1.
    expect(after.stock).toBe(1);
    expect(JSON.parse(after.variants).find((v: { id: string }) => v.id === "white01").stock).toBe(0);

    // White is now sold out.
    expect((await pay([{ productId: p.id, variantId: "white01", quantity: 1 }], 5000)).res.status).toBe(422);
  });

  it("stops a stale price before charging", async () => {
    const p = await lamp({ variants: "[]", stock: null });
    const { res, data } = await pay([{ productId: p.id, variantId: null, quantity: 1 }], 3000);
    expect(res.status).toBe(409);
    expect(data.code).toBe("PRICE_CHANGED");
    expect(square.payments.create).not.toHaveBeenCalled();
  });

  it("refuses an empty cart", async () => {
    const body = { attemptId: randomUUID(), sourceId: "x", customer, items: [], products: [], expectedTotalCents: 0, fulfillment: await validPickup() };
    expect((await checkout(jsonRequest("http://test/api/checkout", body))).status).toBe(400);
  });

  it("brands a shop order's receipt, invoice and emails as LightLab, and leaves print orders as Coastline", async () => {
    const p = await lamp({ variants: "[]", stock: null });
    const { data } = await pay([{ productId: p.id, variantId: null, quantity: 1 }], 4500);
    const order = await db.order.findUniqueOrThrow({ where: { orderNumber: data.orderNumber } });

    const receipt = (await loadReceiptData(order.id))!;
    expect(receipt.brand).toBe("lightlab");
    expect((await renderReceiptPng(receipt)).length).toBeGreaterThan(1000);

    const invoice = (await loadInvoice({ id: order.id }))!;
    expect(invoice).toMatchObject({ brand: "lightlab", business: { name: "LightLab | Victoria" } });
    expect(invoiceFileName(invoice.orderNumber, invoice.brand)).toBe(`LightLab-invoice-${order.orderNumber}.pdf`);
    expect((await renderInvoicePdf(invoice)).subarray(0, 4).toString()).toBe("%PDF");

    const mail = await buildEmail("customer-receipt", (await loadOrderEmailData(order.id))!);
    expect(mail.subject).toBe(`Your LightLab order ${order.orderNumber} is confirmed`);
    expect(mail.html).toContain("/brand/lightlab-logo-dark.png");
    expect(mail.html).not.toContain("/brand/wordmark-white.png");
    expect(mail.html).not.toContain("queue them on the right printer");
    // LightLab blue accents, not Coastline navy.
    expect(mail.html).not.toContain("#0e4471");
    expect(mail.html).toContain("#297f9d");

    // A custom print order is unchanged.
    const print = await createPaidOrder();
    expect((await loadReceiptData(print.id))!.brand).toBe("coastline");
    expect((await loadInvoice({ id: print.id }))!.brand).toBe("coastline");
    const printMail = await buildEmail("customer-receipt", (await loadOrderEmailData(print.id))!);
    expect(printMail.html).toContain("/brand/wordmark-white.png");
    expect(printMail.subject).toContain("Coastline Prints");
    expect(printMail.html).toContain("#0e4471");
    expect(print.orderNumber).toMatch(/^CP-/);
  });
});
