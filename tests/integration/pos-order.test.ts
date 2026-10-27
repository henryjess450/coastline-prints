/**
 * Start order at the register: the customer's order form, the paid order it
 * becomes (made later, picked up on the day they chose), their account, the
 * emails it queues, and the one-tap sign-in link in their receipt.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const { db } = await import("@/lib/db");
const { ringUpSale, PosSaleError } = await import("@/lib/pos/sale.server");
const { orderDetailsError, orderMinDate } = await import("@/lib/pos/types");
const { addDays } = await import("@/lib/pickup");
const { createSignInLink, emailForLink, safeNext } = await import("@/lib/account/link");
const { buildEmail } = await import("@/lib/email/build");
const { loadOrderEmailData } = await import("@/lib/email/data");

const email = () => `${randomUUID().slice(0, 8)}@example.com`;

async function lamp() {
  return db.shopProduct.create({
    data: {
      slug: `lamp-${randomUUID().slice(0, 8)}`,
      name: "Drop Pendant",
      priceCents: 6500,
      stock: null,
      variants: JSON.stringify([
        { id: "black01", name: "Black", priceCents: null, stock: null, hex: "#111111" },
        { id: "white01", name: "White", priceCents: null, stock: null, hex: "#ffffff" },
      ]),
      images: "[]",
      active: true,
    },
  });
}

function sale(productId: string, customerEmail: string, over: Record<string, unknown> = {}) {
  return {
    attemptId: randomUUID(),
    cart: { brand: "lightlab" as const, products: [{ productId, variantId: "black01", quantity: 2 }] },
    expectedTotalCents: 13000,
    payment: "ETRANSFER" as const,
    source: "LightLab market stall",
    customer: { name: "Henry", email: customerEmail, phone: "250 555 0142", notes: "Longer cord please" },
    order: { needBy: addDays(orderMinDate(), 3) },
    ...over,
  };
}

describe("the order form", () => {
  const popup = {
    id: "p1",
    kind: "order" as const,
    firstName: "Henry",
    minDate: "2026-11-03",
    items: [{ key: "a", productId: "x", name: "Drop Pendant", quantity: 1, colours: [{ id: "black01", name: "Black", hex: null }], personalize: "Name on it" }],
  };
  const details = { phone: "2505550142", email: "h@example.com", needBy: "2026-11-03", notes: "", lines: [{ key: "a", variantId: "black01", customText: "Sam" }] };

  it("accepts a filled-in form", () => {
    expect(orderDetailsError(popup, details)).toBeNull();
  });
  it("needs a day at least a week away, a colour and the personalisation", () => {
    expect(orderDetailsError(popup, { ...details, needBy: "2026-11-02" })).toMatch(/week/);
    expect(orderDetailsError(popup, { ...details, lines: [{ key: "a", variantId: null, customText: "Sam" }] })).toMatch(/colour/);
    expect(orderDetailsError(popup, { ...details, lines: [{ key: "a", variantId: "nope", customText: "Sam" }] })).toMatch(/colour/);
    expect(orderDetailsError(popup, { ...details, lines: [{ key: "a", variantId: "black01", customText: "" }] })).toMatch(/Name on it/);
  });
});

describe("taking an order", () => {
  it("makes a paid order for later, their account, and emails them and the owner", async () => {
    const p = await lamp();
    const e = email();
    const s = sale(p.id, e);
    const { order, emailed } = await ringUpSale(s);
    expect(emailed).toBe(true);
    expect(order.status).toBe("PAID"); // not handed over: it still has to be made
    expect(order.pickupDate).toBe(s.order.needBy);
    expect(order.pickupTime).toBeNull();
    expect(order.notes).toBe("Longer cord please");
    expect(order.paymentMethod).toBe("ETRANSFER");

    const account = await db.customer.findUnique({ where: { email: e } });
    expect(account).toMatchObject({ name: "Henry", phone: "250 555 0142" });

    const jobs = await db.outboxJob.findMany({ where: { payload: { contains: order.id } } });
    const receipt = jobs.find((j) => j.template === "customer-receipt");
    expect(JSON.parse(receipt!.payload).signIn).toBe(true);
    expect(jobs.some((j) => j.template === "owner-new-order")).toBe(true);
    expect(jobs.some((j) => j.template === "account-invite")).toBe(false); // the receipt does that job
  });

  it("keeps an existing account and fills in what it's missing", async () => {
    const p = await lamp();
    const e = email();
    await db.customer.create({ data: { email: e, name: "Already Here" } });
    await ringUpSale(sale(p.id, e));
    expect(await db.customer.findUnique({ where: { email: e } })).toMatchObject({ name: "Already Here", phone: "250 555 0142" });
  });

  it("only takes cash or e-Transfer, needs an email, and a day a week out", async () => {
    const p = await lamp();
    await expect(ringUpSale(sale(p.id, email(), { payment: "CARD" }))).rejects.toBeInstanceOf(PosSaleError);
    await expect(ringUpSale(sale(p.id, ""))).rejects.toThrow(/email/);
    await expect(ringUpSale(sale(p.id, email(), { order: { needBy: addDays(orderMinDate(), -1) } }))).rejects.toThrow(/week/);
  });
});

describe("sign-in links", () => {
  it("signs in the right email until it expires, and can't be forged", async () => {
    const e = email();
    const url = new URL(await createSignInLink(e, "/orders/abc"));
    expect(url.searchParams.get("next")).toBe("/orders/abc");
    const token = url.searchParams.get("t")!;
    expect(await emailForLink(token)).toBe(e);
    expect(await emailForLink(token)).toBe(e); // a mail scanner opening it doesn't use it up
    expect(await emailForLink(`${token.split(".")[0]}.wrong`)).toBeNull();
    expect(await emailForLink("nonsense")).toBeNull();
    const old = new URL(await createSignInLink(e, "/", new Date(Date.now() - 15 * 86_400_000))).searchParams.get("t")!;
    expect(await emailForLink(old)).toBeNull();
  });

  it("only sends people to pages on this site", () => {
    expect(safeNext("/orders/x")).toBe("/orders/x");
    expect(safeNext("//evil.example")).toBe("/account");
    expect(safeNext("https://evil.example")).toBe("/account");
    expect(safeNext(null)).toBe("/account");
  });

  it("puts the sign-in button and the ready-by day in the receipt", async () => {
    const p = await lamp();
    const { order } = await ringUpSale(sale(p.id, email()));
    const data = (await loadOrderEmailData(order.id))!;
    const mail = await buildEmail("customer-receipt", data, { signInUrl: "https://coastline.test/api/account/link?t=a.b" });
    expect(mail.html).toContain("Sign in and track your order");
    expect(mail.html).toContain("https://coastline.test/api/account/link?t=a.b");
    expect(mail.html).toContain("Ready by");
    const owner = await buildEmail("owner-new-order", data);
    expect(owner.to).toBe("owner@coastline.test");
  });
});
