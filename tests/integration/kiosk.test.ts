/**
 * The self-checkout kiosk with Square faked. Shop mode: the cart is priced
 * on the server, a payment link is made, nothing happens until Square says
 * it's paid, then the sale is rung up once (stock down, in-person receipt
 * queued). Order mode: the same, but it becomes an order made later (ready by
 * the day they picked), even when the lamp is out of stock right now.
 */
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
const link = { paid: false, paymentId: "PAY-KIOSK-1" };
vi.mock("@/lib/pos/paylink.server", () => ({
  payLinksAvailable: () => true,
  createPayLink: vi.fn(async (id: string) => ({ linkId: `LINK-${id.slice(0, 6)}`, url: `https://square.link/u/${id.slice(0, 6)}`, orderId: `SQORDER-${id.slice(0, 6)}` })),
  payLinkStatus: vi.fn(async () => (link.paid ? { paid: true, paymentId: link.paymentId } : { paid: false })),
  cancelPayLink: vi.fn(async () => undefined),
}));

const { db } = await import("@/lib/db");
const { startKioskSale, checkKioskSale, cancelKioskSale } = await import("@/lib/kiosk/server");
const { orderMinDate } = await import("@/lib/pos/types");
const { addDays } = await import("@/lib/pickup");
const { loadOrderEmailData } = await import("@/lib/email/data");
const { buildEmail } = await import("@/lib/email/build");

const lamp = (over: Record<string, unknown> = {}) => db.shopProduct.create({ data: { slug: `kiosk-lamp-${randomUUID().slice(0, 8)}`, name: "Mushroom Lamp", priceCents: 5900, stock: 3, active: true, ...over } });
const kiosk = (mode: "shop" | "order") => db.kiosk.create({ data: { token: randomUUID(), pairedAt: new Date(), mode, name: `Test ${mode}` } });

beforeEach(() => {
  link.paid = false;
  link.paymentId = "PAY-KIOSK-1";
  square.payments.get.mockReset();
});

describe("shop mode: pay on your phone", () => {
  it("rings the sale up only once Square says it's paid", async () => {
    const p = await lamp();
    const k = await kiosk("shop");
    const sale = await startKioskSale(k.id, { products: [{ productId: p.id, variantId: null, quantity: 2 }], codes: [] }, { name: "Sam Rivera", email: "sam@example.com" });
    expect(sale.status).toBe("PENDING");
    expect(sale.totalCents).toBe(11800);
    expect(sale.url).toContain("square.link");

    // Not paid yet: nothing is rung up.
    expect((await checkKioskSale(k.id, sale.id))?.status).toBe("PENDING");

    // Paid on their phone.
    link.paid = true;
    square.payments.get.mockResolvedValue({ payment: { id: "PAY-KIOSK-1", status: "COMPLETED", amountMoney: { amount: BigInt(11800), currency: "CAD" }, locationId: "TEST_LOCATION", cardDetails: { card: { cardBrand: "VISA", last4: "4242" } } } });
    const done = await checkKioskSale(k.id, sale.id);
    expect(done?.status).toBe("DONE");
    expect(done?.emailed).toBe(true);

    const order = await db.order.findUnique({ where: { orderNumber: done!.orderNumber! }, include: { items: true } });
    expect(order?.source).toBe("LightLab kiosk");
    expect(order?.status).toBe("PICKED_UP");
    expect(order?.squarePaymentId).toBe("PAY-KIOSK-1");
    expect((await db.shopProduct.findUnique({ where: { id: p.id } }))?.stock).toBe(1);

    // Their receipt is the LightLab in-person one.
    const mail = await buildEmail("customer-receipt", (await loadOrderEmailData(order!.id))!);
    expect(mail.subject).toContain("Your LightLab receipt");
    expect(mail.html).toContain("thanks for stopping by!");

    // Checking again never rings it up twice.
    await checkKioskSale(k.id, sale.id);
    expect(await db.order.count({ where: { squarePaymentId: "PAY-KIOSK-1" } })).toBe(1);
  });

  it("cancels the link when they go back, and only its own kiosk can see a sale", async () => {
    const p = await lamp();
    const k = await kiosk("shop");
    const other = await kiosk("shop");
    const sale = await startKioskSale(k.id, { products: [{ productId: p.id, variantId: null, quantity: 1 }], codes: [] }, { name: "Jo", email: "jo@example.com" });
    expect(await checkKioskSale(other.id, sale.id)).toBeNull();
    await cancelKioskSale(k.id, sale.id);
    expect((await db.kioskSale.findUnique({ where: { id: sale.id } }))?.status).toBe("CANCELLED");
  });

  it("needs a name and email", async () => {
    const { kioskCustomerSchema } = await import("@/lib/kiosk/server");
    expect(kioskCustomerSchema.safeParse({ name: "", email: "" }).success).toBe(false);
    expect(kioskCustomerSchema.safeParse({ name: "Sam", email: "nope" }).success).toBe(false);
    expect(kioskCustomerSchema.safeParse({ name: "Sam", email: "sam@example.com" }).success).toBe(true);
  });
});

describe("order mode: made to order, paid on your phone", () => {
  it("becomes an order ready by the day they picked, even if it's out of stock", async () => {
    const p = await lamp({ stock: 0, personalize: "Name on the base", variants: JSON.stringify([{ id: "red01", name: "Red cap", priceCents: null, stock: null, hex: "#c00" }]) });
    const k = await kiosk("order");
    const shopper = `${randomUUID().slice(0, 8)}@example.com`;
    const needBy = addDays(orderMinDate(), 2);
    const sale = await startKioskSale(k.id, { products: [{ productId: p.id, variantId: "red01", quantity: 1, customText: "Ava" }], codes: [] }, { name: "Sam Rivera", email: shopper, phone: "250 555 0142", notes: "Gift wrap please", needBy });
    expect(sale.totalCents).toBe(5900);

    link.paid = true;
    link.paymentId = "PAY-KIOSK-ORDER";
    square.payments.get.mockResolvedValue({ payment: { id: "PAY-KIOSK-ORDER", status: "COMPLETED", amountMoney: { amount: BigInt(5900), currency: "CAD" }, locationId: "TEST_LOCATION" } });
    const done = await checkKioskSale(k.id, sale.id);
    expect(done?.status).toBe("DONE");

    const order = await db.order.findUnique({ where: { orderNumber: done!.orderNumber! }, include: { items: true } });
    expect(order?.source).toBe("LightLab kiosk");
    expect(order?.status).not.toBe("PICKED_UP");
    expect(order?.pickupDate).toBe(needBy);
    expect(order?.customerPhone).toBe("250 555 0142");
    expect(order?.notes).toBe("Gift wrap please");
    expect(order?.items[0]).toMatchObject({ colorName: "Red cap" });
    // Made to order: it's not the in-person receipt.
    const mail = await buildEmail("customer-receipt", (await loadOrderEmailData(order!.id))!, { signInUrl: "https://coastline.test/x" });
    expect(mail.subject).toContain("is confirmed");
    expect(mail.html).toContain("Ready by");
  });

  it("wants a phone number and a day at least a week away", async () => {
    const p = await lamp();
    const k = await kiosk("order");
    const cart = { products: [{ productId: p.id, variantId: null, quantity: 1 }], codes: [] };
    await expect(startKioskSale(k.id, cart, { name: "Sam", email: "sam@example.com", needBy: orderMinDate() })).rejects.toThrow("phone");
    await expect(startKioskSale(k.id, cart, { name: "Sam", email: "sam@example.com", phone: "250 555 0142", needBy: addDays(orderMinDate(), -2) })).rejects.toThrow("at least a week");
  });
});

describe("card processing fee on Square links", () => {
  it("works out a fee that covers Square's cut of the whole total", async () => {
    const { cardFeeFor } = await import("@/lib/pos/card-fee");
    const fee = cardFeeFor(5000, { percent: 2.9, fixedCents: 30 });
    const total = 5000 + fee;
    // What Square keeps from the whole total is no more than the fee.
    expect(Math.round(total * 0.029 + 30)).toBeLessThanOrEqual(fee);
    expect(cardFeeFor(0, { percent: 2.9, fixedCents: 30 })).toBe(0);
  });

  it("adds it as its own line with why, charges it, and keeps it on the order", async () => {
    const { saveCardFee } = await import("@/lib/pos/card-fee.server");
    const { quoteKioskCart } = await import("@/lib/kiosk/server");
    await saveCardFee({ on: true, percent: 2.9, fixedCents: 30 });
    try {
      const p = await lamp({ priceCents: 5000 });
      const k = await kiosk("shop");
      // Said no: nothing added.
      const declined = await quoteKioskCart({ products: [{ productId: p.id, variantId: null, quantity: 1, customText: null }], codes: [], coverFee: false });
      expect(declined.lines.some((l) => l.key === "card-fee")).toBe(false);
      expect(declined.totalCents).toBe(5000);
      // Said yes: the fee is its own line.
      const cart = { products: [{ productId: p.id, variantId: null, quantity: 1, customText: null }], codes: [], coverFee: true };
      const quote = await quoteKioskCart(cart);
      const fee = quote.lines.find((l) => l.key === "card-fee");
      expect(fee?.name).toBe("Card processing fee");
      expect(fee?.detail).toContain("Square charges us 2.9% + 30¢");
      expect(quote.totalCents).toBe(5000 + fee!.cents!);

      const sale = await startKioskSale(k.id, cart, { name: "Jo", email: "jo@example.com" });
      expect(sale.totalCents).toBe(quote.totalCents);
      link.paid = true;
      link.paymentId = "PAY-KIOSK-FEE";
      square.payments.get.mockResolvedValue({ payment: { id: "PAY-KIOSK-FEE", status: "COMPLETED", amountMoney: { amount: BigInt(sale.totalCents), currency: "CAD" }, locationId: "TEST_LOCATION" } });
      const done = await checkKioskSale(k.id, sale.id);
      expect(done?.status).toBe("DONE");
      const order = await db.order.findUnique({ where: { orderNumber: done!.orderNumber! }, include: { items: true } });
      expect(order?.totalCents).toBe(sale.totalCents);
      expect(order?.items.some((i) => i.fileName === "Card processing fee" && i.lineCents === fee!.cents)).toBe(true);
    } finally {
      await saveCardFee({ on: false, percent: 2.9, fixedCents: 30 });
    }
  });

  it("isn't added when it's switched off, or when not paying by link", async () => {
    const { pricePos } = await import("@/lib/pos/price.server");
    const p = await lamp({ priceCents: 5000 });
    const off = await pricePos({ brand: "lightlab", products: [{ productId: p.id, variantId: null, quantity: 1 }], cardFee: true });
    expect(off.lines.some((l) => l.key === "card-fee")).toBe(false);
    const { saveCardFee } = await import("@/lib/pos/card-fee.server");
    await saveCardFee({ on: true, percent: 2.9, fixedCents: 30 });
    try {
      const cash = await pricePos({ brand: "lightlab", products: [{ productId: p.id, variantId: null, quantity: 1 }] });
      expect(cash.totalCents).toBe(5000);
    } finally {
      await saveCardFee({ on: false, percent: 2.9, fixedCents: 30 });
    }
  });
});
