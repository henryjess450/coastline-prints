/**
 * Checkout + webhook flow against a real (test) SQLite database, with Square
 * replaced by a fake client. Covers the pay-before-order rules without keys.
 */
import { createHmac, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SquareError } from "square";
import { cartItem, cubeUpload, customer, jsonRequest, shipAddress, validPickup } from "../helpers/fixtures";

const square = {
  payments: {
    create: vi.fn(),
    get: vi.fn(),
  },
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
const { POST: webhook } = await import("@/app/api/webhooks/square/route");
const { POST: quote } = await import("@/app/api/quote/route");
const { db } = await import("@/lib/db");

function completedPayment(req: { idempotencyKey: string; referenceId: string; amountMoney: { amount: bigint; currency: string } }, over: Record<string, unknown> = {}) {
  return {
    id: `pay_${req.idempotencyKey.slice(0, 8)}`,
    status: "COMPLETED",
    amountMoney: req.amountMoney,
    locationId: "TEST_LOCATION",
    referenceId: req.referenceId,
    receiptUrl: "https://squareup.com/receipt/preview/x",
    cardDetails: { card: { cardBrand: "VISA", last4: "1111" } },
    ...over,
  };
}

async function priceFor(items: unknown[]) {
  const res = await quote(jsonRequest("http://test/api/quote", { items }));
  return (await res.json()).quote.totalCents as number;
}

async function pay(items: unknown[], over: Record<string, unknown> = {}) {
  const expectedTotalCents = await priceFor(items);
  const body = { attemptId: randomUUID(), sourceId: "cnon:card-nonce-ok", customer, items, expectedTotalCents, fulfillment: await validPickup(), ...over };
  const res = await checkout(jsonRequest("http://test/api/checkout", body));
  return { res, data: await res.json(), body };
}

beforeEach(() => {
  square.payments.create.mockReset();
  square.payments.get.mockReset();
  square.customers.search.mockClear();
  square.customers.create.mockClear();
});

describe("checkout", () => {
  it("charges the server price and creates exactly one PAID order", async () => {
    const up = await cubeUpload();
    square.payments.create.mockImplementation(async (req) => ({ payment: completedPayment(req) }));
    const items = [cartItem(up.id, { quantity: 2 })];
    const { res, data } = await pay(items);

    expect(res.status).toBe(200);
    expect(data.status).toBe("paid");
    expect(data.orderNumber).toMatch(/^CP-\d{4}-[2-9A-Z]{4}$/);

    const sent = square.payments.create.mock.calls[0][0];
    expect(sent.amountMoney.currency).toBe("CAD");
    expect(sent.autocomplete).toBe(true);

    const order = await db.order.findUniqueOrThrow({ where: { orderNumber: data.orderNumber }, include: { items: true, events: true, checkout: true } });
    expect(order.status).toBe("PAID");
    expect(order.totalCents).toBe(Number(sent.amountMoney.amount));
    expect(order.cardLast4).toBe("1111");
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ quantity: 2, printerId: "a1-mini", colorName: "Orange" });
    expect(order.events[0].toStatus).toBe("PAID");
    expect(order.checkout.status).toBe("COMPLETED");

    const jobs = await db.outboxJob.findMany({ where: { dedupeKey: { startsWith: order.id } } });
    expect(jobs.map((j) => j.template).sort()).toEqual(["customer-receipt", "owner-new-order"]);
  });

  it("ignores a lower total from the client and refuses if the price changed", async () => {
    const up = await cubeUpload();
    const { res, data } = await pay([cartItem(up.id)], { expectedTotalCents: 1 });
    expect(res.status).toBe(409);
    expect(data.code).toBe("PRICE_CHANGED");
    expect(square.payments.create).not.toHaveBeenCalled();
  });

  it("creates no order when the card is declined", async () => {
    const up = await cubeUpload();
    square.payments.create.mockRejectedValue(
      new SquareError({ statusCode: 402, body: { errors: [{ category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED" }] } }),
    );
    const before = await db.order.count();
    const { res, data, body } = await pay([cartItem(up.id)]);
    expect(res.status).toBe(402);
    expect(data.error).toMatch(/declined/i);
    expect(await db.order.count()).toBe(before);
    const co = await db.checkout.findUniqueOrThrow({ where: { idempotencyKey: body.attemptId } });
    expect(co.status).toBe("FAILED");
  });

  it("blocks items that don't fit any printer before charging", async () => {
    const up = await cubeUpload();
    const items = [cartItem(up.id, { scale: { x: 20, y: 20, z: 20 } })]; // 400 mm cube
    const res = await checkout(jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "x", customer, items, expectedTotalCents: 100, fulfillment: await validPickup() }));
    expect(res.status).toBe(422);
    expect(square.payments.create).not.toHaveBeenCalled();
  });

  it("rejects missing pickup acknowledgement", async () => {
    const up = await cubeUpload();
    const res = await checkout(jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "x", customer: { ...customer, pickupAcknowledged: false }, items: [cartItem(up.id)], expectedTotalCents: 100, fulfillment: await validPickup() }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/pick up/i);
  });

  it("a retried request with the same attempt id doesn't charge or create twice", async () => {
    const up = await cubeUpload();
    // First try: the network drops after Square charged (we never saw the result).
    square.payments.create.mockRejectedValueOnce(new TypeError("fetch failed"));
    const items = [cartItem(up.id)];
    const first = await pay(items);
    expect(first.res.status).toBe(503);
    expect(first.data.retryable).toBe(true);

    // Retry: Square returns the same payment for the same idempotency key.
    square.payments.create.mockImplementation(async (req) => ({ payment: completedPayment(req) }));
    const res2 = await checkout(jsonRequest("http://test/api/checkout", first.body));
    const data2 = await res2.json();
    expect(data2.status).toBe("paid");
    const keys = square.payments.create.mock.calls.map((c) => c[0].idempotencyKey);
    expect(new Set(keys).size).toBe(1);

    // A third duplicate returns the same order without calling Square again.
    const calls = square.payments.create.mock.calls.length;
    const res3 = await checkout(jsonRequest("http://test/api/checkout", first.body));
    expect((await res3.json()).orderNumber).toBe(data2.orderNumber);
    expect(square.payments.create.mock.calls.length).toBe(calls);
    expect(await db.checkout.count({ where: { idempotencyKey: first.body.attemptId } })).toBe(1);
  });

  it("refuses to create an order if the charged amount doesn't match", async () => {
    const up = await cubeUpload();
    square.payments.create.mockImplementation(async (req) => ({ payment: completedPayment(req, { amountMoney: { amount: BigInt(1), currency: "CAD" } }) }));
    const before = await db.order.count();
    const { res } = await pay([cartItem(up.id)]);
    expect(res.status).toBe(503);
    expect(await db.order.count()).toBe(before);
  });
});

describe("square webhook", () => {
  const key = "test-signature-key";
  const url = "https://example.test/api/webhooks/square";

  function signed(body: string) {
    const sig = createHmac("sha256", key).update(url + body).digest("base64");
    return new Request("http://test/api/webhooks/square", { method: "POST", headers: { "x-square-hmacsha256-signature": sig }, body });
  }

  beforeEach(() => {
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = key;
    process.env.SQUARE_WEBHOOK_URL = url;
  });

  it("rejects a bad signature", async () => {
    const res = await webhook(new Request("http://test", { method: "POST", headers: { "x-square-hmacsha256-signature": "nope" }, body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("creates the order when the browser never got the response, and is idempotent with the direct path", async () => {
    const up = await cubeUpload();
    // Square accepted the payment but reported it as still processing.
    let charged: ReturnType<typeof completedPayment> | null = null;
    square.payments.create.mockImplementation(async (req) => {
      charged = completedPayment(req);
      return { payment: { ...charged, status: "APPROVED" } };
    });
    const { res, body } = await pay([cartItem(up.id)]);
    expect(res.status).toBe(202);
    const co = await db.checkout.findUniqueOrThrow({ where: { idempotencyKey: body.attemptId } });
    expect(await db.order.findUnique({ where: { checkoutId: co.id } })).toBeNull();

    // Then it completes and Square sends payment.updated (twice, as webhooks may).
    square.payments.get.mockResolvedValue({ payment: charged });
    const event = JSON.stringify({ type: "payment.updated", data: { id: charged!.id } });
    const [a, b] = await Promise.all([webhook(signed(event)), webhook(signed(event))]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await db.order.count({ where: { checkoutId: co.id } })).toBe(1);

    // The browser's polling endpoint now sees the order.
    const { GET } = await import("@/app/api/checkout/[attemptId]/route");
    const poll = await GET(new Request("http://test"), { params: Promise.resolve({ attemptId: body.attemptId }) });
    expect((await poll.json()).status).toBe("paid");
  });

  it("answers Square's dashboard test event (unknown payment) with 200", async () => {
    square.payments.get.mockRejectedValue(new SquareError({ statusCode: 404, body: { errors: [{ category: "INVALID_REQUEST_ERROR", code: "NOT_FOUND" }] } }));
    const res = await webhook(signed(JSON.stringify({ type: "payment.updated", data: { id: "KkAkhdMsgzn59SM8A89WgKwekxLZY" } })));
    expect(res.status).toBe(200);
  });

  it("ignores payments that aren't from this site", async () => {
    square.payments.get.mockResolvedValue({ payment: { id: "pay_pos", status: "COMPLETED", referenceId: "in-store-sale", amountMoney: { amount: BigInt(500), currency: "CAD" } } });
    const res = await webhook(signed(JSON.stringify({ type: "payment.updated", data: { id: "pay_pos" } })));
    expect(res.status).toBe(200);
  });
});

describe("shipping", () => {
  async function shippingFor(items: unknown[]) {
    const res = await quote(jsonRequest("http://test/api/quote", { items }));
    return (await res.json()).quote.shipping;
  }

  it("charges prints plus the flat rate box and keeps the address on the order", async () => {
    const up = await cubeUpload();
    square.payments.create.mockImplementation(async (req) => ({ payment: completedPayment(req) }));
    const items = [cartItem(up.id)];
    const quoted = await shippingFor(items);
    // A 20 mm cube is too thick for a mailer, so the tracked box is the only option.
    expect(quoted.options).toHaveLength(1);
    const ship = quoted.options[0];
    expect(ship).toMatchObject({ method: "box", tracked: true, boxes: [{ id: "xs", pieces: 1 }], taxCents: 95, totalCents: 1899 + 95 + 200 });

    const expectedTotalCents = (await priceFor(items)) + ship.totalCents;
    const body = {
      attemptId: randomUUID(),
      sourceId: "cnon:card-nonce-ok",
      // No pickup to acknowledge when shipping.
      customer: { ...customer, pickupAcknowledged: false },
      items,
      expectedTotalCents,
      fulfillment: { method: "ship", option: "box", address: shipAddress },
    };
    const res = await checkout(jsonRequest("http://test/api/checkout", body));
    const data = await res.json();
    expect(res.status).toBe(200);

    const sent = square.payments.create.mock.calls[0][0];
    expect(Number(sent.amountMoney.amount)).toBe(expectedTotalCents);
    expect(sent.shippingAddress).toMatchObject({ addressLine1: "1 Main Street", locality: "Halifax", administrativeDistrictLevel1: "NS", postalCode: "B3H 1A1", country: "CA" });

    const order = await db.order.findUniqueOrThrow({ where: { orderNumber: data.orderNumber } });
    expect(order).toMatchObject({ fulfillment: "SHIP", shippingCents: 2194, shipCity: "Halifax", shipPostal: "B3H 1A1", pickupDate: null, totalCents: expectedTotalCents });
    expect(JSON.parse(order.shippingBoxes!)).toEqual([{ id: "xs", name: "Extra Small", priceCents: 1899, pieces: 1 }]);
  });

  it("refuses to ship a print too big for any box, before charging", async () => {
    // A 200 mm wireframe cube: quick to print, but taller than every box is deep.
    const up = await db.upload.update({ where: { id: (await cubeUpload()).id }, data: { bboxX: 200, bboxY: 200, bboxZ: 200, volumeMm3: 4000, surfaceAreaMm2: 3000 } });
    const items = [cartItem(up.id)];
    expect((await shippingFor(items)).ok).toBe(false);
    const res = await checkout(
      jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "x", customer, items, expectedTotalCents: 1, fulfillment: { method: "ship", option: "box", address: shipAddress } }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("SHIPPING_UNAVAILABLE");
    expect(square.payments.create).not.toHaveBeenCalled();
  });

  it("rejects an address outside Canada", async () => {
    const up = await cubeUpload();
    const res = await checkout(
      jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "x", customer, items: [cartItem(up.id)], expectedTotalCents: 1, fulfillment: { method: "ship", option: "box", address: { ...shipAddress, postal: "90210" } } }),
    );
    expect(res.status).toBe(400);
  });
});

describe("bubble mailer", () => {
  it("charges the Lettermail price for a flat print and refuses a mailer the order doesn't fit", async () => {
    // A 60 × 40 × 3 mm tag.
    const flat = await db.upload.update({ where: { id: (await cubeUpload()).id }, data: { bboxX: 60, bboxY: 40, bboxZ: 3, volumeMm3: 7200, surfaceAreaMm2: 5400 } });
    square.payments.create.mockImplementation(async (req) => ({ payment: completedPayment(req) }));
    const items = [cartItem(flat.id)];
    const quoted = (await (await quote(jsonRequest("http://test/api/quote", { items }))).json()).quote.shipping;
    expect(quoted.options.map((o: { method: string }) => o.method)).toEqual(["mailer", "box"]);
    const mailer = quoted.options[0];

    const total = (await priceFor(items)) + mailer.totalCents;
    const res = await checkout(jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "cnon:ok", customer, items, expectedTotalCents: total, fulfillment: { method: "ship", option: "mailer", address: shipAddress } }));
    const data = await res.json();
    expect(res.status).toBe(200);
    const order = await db.order.findUniqueOrThrow({ where: { orderNumber: data.orderNumber } });
    expect(order.shippingCents).toBe(mailer.totalCents);
    expect(JSON.parse(order.shippingBoxes!)[0].id).toBe("mailer");

    // The cube is too thick for a mailer.
    const cube = await cubeUpload();
    const bad = await checkout(jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "cnon:ok", customer, items: [cartItem(cube.id)], expectedTotalCents: 1, fulfillment: { method: "ship", option: "mailer", address: shipAddress } }));
    expect(bad.status).toBe(409);
    expect((await bad.json()).code).toBe("SHIPPING_CHANGED");
  });
});

describe("tracked bubble mailer (parcel)", () => {
  it("prices it live from Canada Post and charges that at checkout", async () => {
    process.env.CANADA_POST_USERNAME = "user";
    process.env.CANADA_POST_PASSWORD = "pass";
    process.env.CANADA_POST_FROM_POSTAL = "A1A1A1";
    const realFetch = globalThis.fetch;
    const cp = vi.fn(async () => new Response(`<price-quotes><price-quote><service-code>DOM.RP</service-code><price-details><taxes><gst>0.55</gst></taxes><due>11.55</due></price-details></price-quote></price-quotes>`));
    globalThis.fetch = cp as never;
    try {
      // 30 mm thick: too thick for Lettermail, fine for a parcel mailer.
      const up = await db.upload.update({ where: { id: (await cubeUpload()).id }, data: { bboxX: 100, bboxY: 60, bboxZ: 30, volumeMm3: 9000, surfaceAreaMm2: 6000 } });
      const items = [cartItem(up.id)];
      const { POST: rates } = await import("@/app/api/shipping/rates/route");
      const { option } = await (await rates(jsonRequest("http://test/api/shipping/rates", { items, postal: "b3h 1a1" }))).json();
      expect(option).toMatchObject({ method: "parcel", tracked: true, postageCents: 1100, taxCents: 55, taxLabel: "GST", totalCents: 1100 + 55 + 200 });
      const bodies = cp.mock.calls.map((c) => String(((c as unknown[])[1] as RequestInit).body));
      // The tax rate is read once, from the shop's own postal code (tax depends on where it's mailed from).
      expect(bodies[0]).toContain("<postal-code>A1A1A1</postal-code>");
      const sent = bodies.find((b) => b.includes("B3H1A1"))!;
      expect(sent).toContain("<origin-postal-code>A1A1A1</origin-postal-code>");
      expect(sent).toContain("<postal-code>B3H1A1</postal-code>");
      expect(sent).toContain("<quote-type>counter</quote-type>");

      square.payments.create.mockImplementation(async (req) => ({ payment: completedPayment(req) }));
      const total = (await priceFor(items)) + option.totalCents;
      const res = await checkout(jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "cnon:ok", customer, items, expectedTotalCents: total, fulfillment: { method: "ship", option: "parcel", address: shipAddress } }));
      const data = await res.json();
      expect(res.status).toBe(200);
      const order = await db.order.findUniqueOrThrow({ where: { orderNumber: data.orderNumber } });
      expect(order.shippingCents).toBe(1355);
      expect(JSON.parse(order.shippingBoxes!)[0].id).toBe("parcel-mailer");
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.CANADA_POST_USERNAME;
      delete process.env.CANADA_POST_PASSWORD;
      delete process.env.CANADA_POST_FROM_POSTAL;
    }
  });
});

describe("pickup booking", () => {
  it("rejects a pickup slot outside the schedule and stores a valid one on the order", async () => {
    const up = await cubeUpload();
    const bad = await pay([cartItem(up.id)], { fulfillment: { method: "pickup", date: "2020-01-01", time: "03:00" } });
    expect(bad.res.status).toBe(400);
    expect(bad.data.code).toBe("PICKUP_UNAVAILABLE");
    expect(square.payments.create).not.toHaveBeenCalled();

    square.payments.create.mockImplementation(async (req) => ({ payment: completedPayment(req) }));
    const slot = await validPickup();
    const ok = await pay([cartItem(up.id)], { fulfillment: slot });
    const order = await db.order.findUniqueOrThrow({ where: { orderNumber: ok.data.orderNumber } });
    expect(order.pickupDate).toBe(slot.date);
    expect(order.pickupTime).toBe(slot.time);
  });
});

describe("coupons, gift cards and customers", () => {
  async function code(data: Record<string, unknown>) {
    return db.promoCode.create({ data: { code: `T${Math.random().toString(36).slice(2, 10).toUpperCase()}`, kind: "PERCENT", ...data } as never });
  }
  async function quoteTotal(items: unknown[]) {
    return priceFor(items);
  }

  it("applies a coupon, charges the discounted amount and links the Square customer", async () => {
    const up = await cubeUpload();
    const c = await code({ kind: "PERCENT", percentOff: 50, maxUses: 1 });
    square.payments.create.mockImplementation(async (req) => ({ payment: completedPayment(req) }));
    const items = [cartItem(up.id)];
    const full = await quoteTotal(items);
    const expected = full - Math.round(full / 2);
    const res = await checkout(jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "cnon:ok", customer, items, expectedTotalCents: expected, fulfillment: await validPickup(), codes: [c.code.toLowerCase()] }));
    const data = await res.json();
    expect(res.status, JSON.stringify(data)).toBe(200);
    const sent = square.payments.create.mock.calls.at(-1)![0];
    expect(Number(sent.amountMoney.amount)).toBe(expected);
    expect(sent.customerId).toBe("SQCUST1");
    const order = await db.order.findUniqueOrThrow({ where: { orderNumber: data.orderNumber } });
    expect(order.discountCents).toBe(full - expected);
    expect(order.squareCustomerId).toBe("SQCUST1");
    expect((await db.promoCode.findUniqueOrThrow({ where: { id: c.id } })).uses).toBe(1);

    // Used up: a second checkout with it is refused before charging.
    const calls = square.payments.create.mock.calls.length;
    const again = await checkout(jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "cnon:ok", customer, items, expectedTotalCents: expected, fulfillment: await validPickup(), codes: [c.code] }));
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe("CODE_INVALID");
    expect(square.payments.create.mock.calls.length).toBe(calls);
  });

  it("a gift card covering everything places the order without charging a card", async () => {
    const up = await cubeUpload();
    const gc = await code({ kind: "GIFT_CARD", initialCents: 100000, balanceCents: 100000 });
    const items = [cartItem(up.id)];
    const full = await quoteTotal(items);
    const res = await checkout(jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), customer, items, expectedTotalCents: 0, fulfillment: await validPickup(), codes: [gc.code] }));
    const data = await res.json();
    expect(res.status, JSON.stringify(data)).toBe(200);
    expect(square.payments.create).not.toHaveBeenCalled();
    const order = await db.order.findUniqueOrThrow({ where: { orderNumber: data.orderNumber } });
    expect(order).toMatchObject({ totalCents: 0, giftCardCents: full });
    expect(order.squarePaymentId).toMatch(/^nopay_/);
    expect((await db.promoCode.findUniqueOrThrow({ where: { id: gc.id } })).balanceCents).toBe(100000 - full);
  });

  it("gives the gift card balance back when the card is declined", async () => {
    const up = await cubeUpload();
    const gc = await code({ kind: "GIFT_CARD", initialCents: 300, balanceCents: 300 });
    square.payments.create.mockRejectedValue(new SquareError({ statusCode: 402, body: { errors: [{ category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED" }] } }));
    const items = [cartItem(up.id)];
    const full = await quoteTotal(items);
    const res = await checkout(jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "cnon:declined", customer, items, expectedTotalCents: full - 300, fulfillment: await validPickup(), codes: [gc.code] }));
    expect(res.status).toBe(402);
    expect((await db.promoCode.findUniqueOrThrow({ where: { id: gc.id } })).balanceCents).toBe(300);
    const r = await db.codeRedemption.findFirstOrThrow({ where: { codeId: gc.id } });
    expect(r.status).toBe("RELEASED");
  });

  it("counts repeat customers and still sells if Square customers is down", async () => {
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "test-token");
    square.customers.search.mockRejectedValueOnce(new Error("Square down"));
    square.payments.create.mockImplementation(async (req) => ({ payment: completedPayment(req) }));
    const email = `repeat-${randomUUID()}@example.com`;
    const nums: number[] = [];
    for (let i = 0; i < 2; i++) {
      const up = await cubeUpload();
      const items = [cartItem(up.id)];
      const res = await checkout(jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "cnon:ok", customer: { ...customer, email }, items, expectedTotalCents: await quoteTotal(items), fulfillment: await validPickup() }));
      const data = await res.json();
      expect(res.status, JSON.stringify(data)).toBe(200);
      const o = await db.order.findUniqueOrThrow({ where: { orderNumber: data.orderNumber } });
      nums.push(o.customerOrderCount);
      if (i === 0) {
        expect(o.squareCustomerId).toBeNull();
        expect(await db.outboxJob.count({ where: { dedupeKey: `${o.id}:customer-sync` } })).toBe(1);
      }
    }
    expect(nums).toEqual([1, 2]);
    vi.unstubAllEnvs();
  });
});
