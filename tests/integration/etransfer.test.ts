/**
 * e-Transfer checkout: the order waits for the deposit email, which pays it by
 * code (or by exact amount), and anything doubtful goes to the owner.
 */
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cartItem, cubeUpload, customer, jsonRequest, validPickup } from "../helpers/fixtures";

const square = {
  payments: { create: vi.fn(), get: vi.fn() },
  customers: { search: vi.fn(async () => ({ customers: [] })), create: vi.fn(async () => ({ customer: { id: "SQCUST1" } })), get: vi.fn() },
};
vi.mock("@/lib/square/client", () => ({
  getSquare: () => square,
  squareLocationId: () => "TEST_LOCATION",
  squarePublicConfig: () => ({ applicationId: "app", locationId: "TEST_LOCATION", environment: "sandbox", scriptUrl: "" }),
}));

beforeAll(() => {
  Object.assign(process.env, { ETRANSFER_EMAIL: "pay@coastline.test", ETRANSFER_IMAP_HOST: "imap.test", ETRANSFER_IMAP_USER: "inbox@coastline.test", ETRANSFER_IMAP_PASSWORD: "x" });
});

const { POST: checkout } = await import("@/app/api/checkout/route");
const { GET: poll } = await import("@/app/api/checkout/[attemptId]/route");
const { POST: quote } = await import("@/app/api/quote/route");
const { db } = await import("@/lib/db");
const { handleDepositEmail, expireEtransfers, confirmByOwner, EtransferConfirmError } = await import("@/lib/payments/etransfer.server");

async function placeEtransferOrder(over: { quantity?: number } = {}) {
  const up = await cubeUpload();
  const items = [cartItem(up.id, { quantity: over.quantity ?? 1 })];
  const full = (await (await quote(jsonRequest("http://test/api/quote", { items }))).json()).quote.totalCents as number;
  const due = full - Math.round(full * 0.02);
  const attemptId = randomUUID();
  const res = await checkout(jsonRequest("http://test/api/checkout", { attemptId, payment: "etransfer", customer, items, expectedTotalCents: due, fulfillment: await validPickup() }));
  return { res, data: await res.json(), due, full, attemptId };
}

const email = (over: { amount: number; message?: string; verified?: boolean; deposited?: boolean; id?: string }) => ({
  messageId: over.id ?? `<${randomUUID()}@interac.ca>`,
  receivedAt: new Date(),
  subject: "INTERAC e-Transfer: SAM RIVERS sent you money.",
  text: `SAM RIVERS sent you $${(over.amount / 100).toFixed(2)} (CAD)${over.deposited === false ? "." : " and the money has been automatically deposited."}\nAmount: $${(over.amount / 100).toFixed(2)} (CAD)\nSent From: SAM RIVERS\nMessage: ${over.message ?? "(none)"}`,
  fromDomain: "payments.interac.ca",
  verified: over.verified ?? true,
});

beforeEach(async () => {
  square.payments.create.mockReset();
  // Each test starts with no one waiting, so amount matching sees only its own order.
  await db.checkout.updateMany({ where: { paymentMethod: "ETRANSFER", status: "PENDING" }, data: { status: "FAILED" } });
});

describe("e-Transfer checkout", () => {
  it("holds the order with a code, 2% off, and never charges a card", async () => {
    const { res, data, due, attemptId } = await placeEtransferOrder();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ status: "awaiting_etransfer", amountCents: due, sendTo: "pay@coastline.test" });
    expect(data.code).toMatch(/^PAY-[A-Z0-9]{5}$/);
    expect(square.payments.create).not.toHaveBeenCalled();
    const co = await db.checkout.findUniqueOrThrow({ where: { idempotencyKey: attemptId } });
    expect(co).toMatchObject({ paymentMethod: "ETRANSFER", status: "PENDING", totalCents: due });
    expect(co.expiresAt!.getTime() - co.createdAt.getTime()).toBeCloseTo(2 * 3600_000, -4);
    expect(await db.outboxJob.findUnique({ where: { dedupeKey: `${co.id}:etransfer-instructions` } })).not.toBeNull();
    expect(await db.order.findFirst({ where: { checkoutId: co.id } })).toBeNull();
  });

  it("pays the order when the deposit email with its code arrives", async () => {
    const { data, due, attemptId } = await placeEtransferOrder();
    const dep = await handleDepositEmail(email({ amount: due, message: data.code.toLowerCase().replace("-", " ") }));
    expect(dep?.status).toBe("MATCHED");
    const order = await db.order.findFirstOrThrow({ where: { checkout: { idempotencyKey: attemptId } } });
    expect(order).toMatchObject({ paymentMethod: "ETRANSFER", totalCents: due, status: "PAID" });
    expect(order.etransferDiscountCents).toBeGreaterThan(0);
    const polled = await (await poll(new Request(`http://test/api/checkout/${attemptId}`), { params: Promise.resolve({ attemptId }) })).json();
    expect(polled).toMatchObject({ status: "paid", viewToken: order.viewToken });
    // The same email again does nothing.
    expect(await handleDepositEmail({ ...email({ amount: due, message: data.code }), messageId: dep!.messageId })).toBeNull();
  });

  it("matches a deposit without a code when exactly one waiting order has that amount", async () => {
    const { due, attemptId } = await placeEtransferOrder({ quantity: 3 });
    expect((await handleDepositEmail(email({ amount: due })))?.status).toBe("MATCHED");
    expect(await db.order.findFirst({ where: { checkout: { idempotencyKey: attemptId } } })).not.toBeNull();
  });

  it("sends doubtful deposits to the owner instead of paying anything", async () => {
    const { data, due, attemptId } = await placeEtransferOrder({ quantity: 4 });
    const forged = await handleDepositEmail(email({ amount: due, message: data.code, verified: false }));
    expect(forged).toMatchObject({ status: "REVIEW", note: expect.stringMatching(/really came from Interac/) });
    expect((await handleDepositEmail(email({ amount: due - 100, message: data.code })))?.note).toMatch(/Short/);
    expect((await handleDepositEmail(email({ amount: due, message: "PAY-ZZZZZ" })))?.note).toMatch(/doesn't match any order/);
    expect((await handleDepositEmail(email({ amount: due, message: data.code, deposited: false })))?.note).toMatch(/Accept it in your bank/);
    expect((await handleDepositEmail(email({ amount: 1 })))?.note).toMatch(/no waiting order/);
    expect(await db.order.findFirst({ where: { checkout: { idempotencyKey: attemptId } } })).toBeNull();

    // The owner checks the bank and confirms the forged-looking one by hand.
    const co = await db.checkout.findUniqueOrThrow({ where: { idempotencyKey: attemptId } });
    const r = await confirmByOwner(co.id, forged!.id);
    expect(r?.order.paymentMethod).toBe("ETRANSFER");
    await expect(confirmByOwner(co.id, null)).rejects.toThrow(EtransferConfirmError);
  });

  it("cancels unpaid orders when time runs out, and still takes a late payment with no codes held", async () => {
    const { data, due, attemptId } = await placeEtransferOrder({ quantity: 5 });
    await db.checkout.update({ where: { idempotencyKey: attemptId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await expireEtransfers()).toBeGreaterThanOrEqual(1);
    const polled = await (await poll(new Request(`http://test/api/checkout/${attemptId}`), { params: Promise.resolve({ attemptId }) })).json();
    expect(polled.status).toBe("expired");
    expect((await handleDepositEmail(email({ amount: due, message: data.code })))?.status).toBe("MATCHED");
    expect(await db.order.findFirst({ where: { checkout: { idempotencyKey: attemptId } } })).not.toBeNull();
  });
});
