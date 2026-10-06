/**
 * Buying a gift card against the test database, with Square faked.
 * The card is only created after a completed payment, exactly once, and the
 * recipient's email waits until the scheduled time.
 */
import { createHmac, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SquareError } from "square";
import { jsonRequest } from "../helpers/fixtures";

const square = { payments: { create: vi.fn(), get: vi.fn() } };
vi.mock("@/lib/square/client", () => ({
  getSquare: () => square,
  squareLocationId: () => "TEST_LOCATION",
  squarePublicConfig: () => ({ applicationId: "app", locationId: "TEST_LOCATION", environment: "sandbox", scriptUrl: "" }),
}));

const { POST: buy } = await import("@/app/api/gift-cards/route");
const { GET: poll } = await import("@/app/api/gift-cards/[attemptId]/route");
const { POST: webhook } = await import("@/app/api/webhooks/square/route");
const { db } = await import("@/lib/db");
const { processOutbox } = await import("@/lib/notify/outbox");
const { scheduleRange } = await import("@/lib/giftcards/rules");

function completed(req: { idempotencyKey: string; referenceId: string; amountMoney: { amount: bigint; currency: string } }) {
  return { id: `pay_${req.idempotencyKey.slice(0, 8)}`, status: "COMPLETED", amountMoney: req.amountMoney, locationId: "TEST_LOCATION", referenceId: req.referenceId, cardDetails: { card: { cardBrand: "VISA", last4: "4242" } } };
}

const details = { amountCents: 5000, recipientName: "Jordan Lee", recipientEmail: "jordan@example.com", message: "Happy birthday!", buyerName: "Sam Rivera", buyerEmail: "sam@example.com", sendOn: null as string | null };

async function purchase(over: Record<string, unknown> = {}) {
  const body = { ...details, attemptId: randomUUID(), sourceId: "cnon:card-nonce-ok", expectedTotalCents: details.amountCents, ...over };
  if ("amountCents" in over && !("expectedTotalCents" in over)) body.expectedTotalCents = over.amountCents as number;
  const res = await buy(jsonRequest("http://test/api/gift-cards", body));
  return { res, data: await res.json(), body };
}

beforeEach(() => {
  square.payments.create.mockReset();
  square.payments.get.mockReset();
});

describe("buying a gift card", () => {
  it("charges the amount, creates one card with the full balance, and queues the emails", async () => {
    square.payments.create.mockImplementation(async (req) => ({ payment: completed(req) }));
    const { res, data, body } = await purchase();
    expect(res.status).toBe(200);
    expect(data).toEqual({ status: "paid", recipientName: "Jordan Lee", sendOn: null });

    const sent = square.payments.create.mock.calls[0][0];
    expect(Number(sent.amountMoney.amount)).toBe(5000);
    expect(sent.referenceId).toMatch(/^gift_/);

    const p = await db.giftPurchase.findUniqueOrThrow({ where: { idempotencyKey: body.attemptId }, include: { code: true } });
    expect(p.status).toBe("PAID");
    expect(p.code).toMatchObject({ kind: "GIFT_CARD", initialCents: 5000, balanceCents: 5000 });
    expect(p.code!.code).toMatch(/^[1-9]\d{15}$/);
    expect(p.code!.pin).toMatch(/^CP\d{5}$/);

    const jobs = await db.outboxJob.findMany({ where: { dedupeKey: { startsWith: p.id } } });
    expect(jobs.map((j) => j.template).sort()).toEqual(["gift-buyer", "gift-owner", "gift-recipient"]);
  });

  it("holds the recipient's email until 9 am on the chosen day", async () => {
    square.payments.create.mockImplementation(async (req) => ({ payment: completed(req) }));
    const { min } = scheduleRange();
    const { res, body } = await purchase({ sendOn: min });
    expect(res.status).toBe(200);
    const p = await db.giftPurchase.findUniqueOrThrow({ where: { idempotencyKey: body.attemptId } });
    const recipientJob = await db.outboxJob.findUniqueOrThrow({ where: { dedupeKey: `${p.id}:gift-recipient` } });
    expect(recipientJob.nextAttemptAt.getTime()).toBe(p.deliverAt.getTime());
    expect(p.deliverAt.getTime()).toBeGreaterThan(Date.now());

    // Nothing goes out while the animation plays.
    const mailer = { mode: "preview" as const, send: async () => {} };
    await processOutbox({ mailer }); // let any run already in progress finish first
    expect((await db.outboxJob.findUniqueOrThrow({ where: { dedupeKey: `${p.id}:gift-buyer` } })).status).toBe("PENDING");

    // When it finishes, the receipt and owner emails go, but the gift itself keeps its date.
    const { POST: sendoff } = await import("@/app/api/sendoff/route");
    expect((await sendoff(jsonRequest("http://test/api/sendoff", { gift: body.attemptId }))).status).toBe(200);
    await processOutbox({ mailer });
    const buyerJob = await db.outboxJob.findUniqueOrThrow({ where: { dedupeKey: `${p.id}:gift-buyer` } });
    expect(buyerJob.lastError ?? "").toBe("");
    expect(buyerJob.status).toBe("SENT");
    expect((await db.outboxJob.findUniqueOrThrow({ where: { dedupeKey: `${p.id}:gift-recipient` } })).status).toBe("PENDING");
  });

  it("creates no card when the card is declined", async () => {
    square.payments.create.mockRejectedValue(new SquareError({ statusCode: 402, body: { errors: [{ category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED" }] } }));
    const { res, body } = await purchase();
    expect(res.status).toBe(402);
    const p = await db.giftPurchase.findUniqueOrThrow({ where: { idempotencyKey: body.attemptId } });
    expect(p.status).toBe("FAILED");
    expect(p.codeId).toBeNull();
  });

  it("refuses bad amounts and dates before charging", async () => {
    expect((await purchase({ amountCents: 500 })).res.status).toBe(400);
    expect((await purchase({ sendOn: "2020-01-01" })).res.status).toBe(400);
    expect((await purchase({ expectedTotalCents: 1 })).res.status).toBe(409);
    expect(square.payments.create).not.toHaveBeenCalled();
  });

  it("returns the same result for a retried attempt without charging again", async () => {
    square.payments.create.mockImplementation(async (req) => ({ payment: completed(req) }));
    const { body } = await purchase();
    const again = await buy(jsonRequest("http://test/api/gift-cards", body));
    expect(again.status).toBe(200);
    expect(square.payments.create).toHaveBeenCalledTimes(1);
    expect(await db.giftPurchase.count({ where: { idempotencyKey: body.attemptId } })).toBe(1);
  });
});

describe("gift card payment finishing later", () => {
  const key = "test-signature-key";
  const url = "https://example.test/api/webhooks/square";
  const signed = (body: string) => new Request("http://test/api/webhooks/square", { method: "POST", headers: { "x-square-hmacsha256-signature": createHmac("sha256", key).update(url + body).digest("base64") }, body });
  beforeEach(() => {
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = key;
    process.env.SQUARE_WEBHOOK_URL = url;
  });

  it("the webhook creates the card exactly once, and polling then reports paid", async () => {
    let charged: ReturnType<typeof completed> | null = null;
    square.payments.create.mockImplementation(async (req) => {
      charged = completed(req);
      return { payment: { ...charged, status: "APPROVED" } };
    });
    const { res, body } = await purchase();
    expect(res.status).toBe(202);

    square.payments.get.mockResolvedValue({ payment: charged });
    const event = JSON.stringify({ type: "payment.updated", data: { id: charged!.id } });
    const [a, b] = await Promise.all([webhook(signed(event)), webhook(signed(event))]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const p = await db.giftPurchase.findUniqueOrThrow({ where: { idempotencyKey: body.attemptId } });
    expect(p.status).toBe("PAID");
    expect(await db.promoCode.count({ where: { purchase: { id: p.id } } })).toBe(1);
    expect(await db.outboxJob.count({ where: { dedupeKey: `${p.id}:gift-recipient` } })).toBe(1);

    const polled = await poll(new Request(`http://test/api/gift-cards/${body.attemptId}`), { params: Promise.resolve({ attemptId: body.attemptId }) });
    expect(await polled.json()).toMatchObject({ status: "paid", recipientName: "Jordan Lee" });
  });
});
