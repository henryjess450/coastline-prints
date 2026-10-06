/**
 * Square customers are found or created exactly once per email, never
 * duplicated, and new accounts are saved to Square. Square is faked.
 */
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SquareError } from "square";

const square = { customers: { search: vi.fn(), get: vi.fn(), create: vi.fn() } };
vi.mock("@/lib/square/client", () => ({ getSquare: () => square, squareLocationId: () => "LOC", squarePublicConfig: () => null }));

const { db } = await import("@/lib/db");
const { findOrCreateSquareCustomer } = await import("@/lib/square/customers");
const { createLoginCode, verifyLoginCode } = await import("@/lib/account/auth");
const { processOutbox } = await import("@/lib/notify/outbox");

const email = () => `${randomUUID().slice(0, 8)}@example.com`;
const details = (e: string) => ({ name: "Sam Rivers", email: e, phone: "604 555 0123" });
const squareError = (code: string, field?: string) => new SquareError({ statusCode: 400, body: { errors: [{ category: "INVALID_REQUEST_ERROR", code, field }] } });

beforeEach(() => {
  square.customers.search.mockReset().mockResolvedValue({ customers: [] });
  square.customers.get.mockReset();
  square.customers.create.mockReset().mockImplementation(async () => ({ customer: { id: `SQ_${randomUUID().slice(0, 6)}` } }));
});

describe("Square customers are never duplicated", () => {
  it("uses the customer Square already has", async () => {
    square.customers.search.mockResolvedValue({ customers: [{ id: "SQ_EXISTING" }] });
    expect(await findOrCreateSquareCustomer(details(email()))).toBe("SQ_EXISTING");
    expect(square.customers.create).not.toHaveBeenCalled();
  });

  it("creates only once when many requests for the same email arrive together", async () => {
    const e = email();
    const ids = await Promise.all(Array.from({ length: 5 }, () => findOrCreateSquareCustomer(details(e.toUpperCase()))));
    expect(new Set(ids).size).toBe(1);
    expect(square.customers.create).toHaveBeenCalledTimes(1);
  });

  it("finds a just-created customer even when Square's search hasn't caught up", async () => {
    const e = email();
    await db.customer.create({ data: { email: e, squareCustomerId: "SQ_SAVED" } });
    square.customers.get.mockResolvedValue({ customer: { id: "SQ_SAVED" } });
    expect(await findOrCreateSquareCustomer(details(e))).toBe("SQ_SAVED");
    expect(square.customers.create).not.toHaveBeenCalled();
  });

  it("searches again instead of creating with a new key when the key was already used", async () => {
    square.customers.create.mockRejectedValue(squareError("IDEMPOTENCY_KEY_REUSED"));
    square.customers.search.mockResolvedValueOnce({ customers: [] }).mockResolvedValue({ customers: [{ id: "SQ_FROM_EARLIER" }] });
    expect(await findOrCreateSquareCustomer(details(email()))).toBe("SQ_FROM_EARLIER");
    expect(square.customers.create).toHaveBeenCalledTimes(1);
  }, 15_000);

  it("only retries without the phone when Square rejects the phone, and checks again first", async () => {
    square.customers.create.mockRejectedValueOnce(squareError("INVALID_PHONE_NUMBER", "phone_number")).mockResolvedValue({ customer: { id: "SQ_NO_PHONE" } });
    expect(await findOrCreateSquareCustomer(details(email()))).toBe("SQ_NO_PHONE");
    expect(square.customers.search).toHaveBeenCalledTimes(2);
    expect(square.customers.create.mock.calls[1][0].phoneNumber).toBeUndefined();
  });

  it("doesn't make a second customer for other errors", async () => {
    square.customers.create.mockRejectedValue(squareError("INTERNAL_SERVER_ERROR"));
    await expect(findOrCreateSquareCustomer(details(email()))).rejects.toBeInstanceOf(SquareError);
    expect(square.customers.create).toHaveBeenCalledTimes(1);
  });
});

describe("new accounts are saved to Square", () => {
  it("queues one sync on first sign-in, links the Square customer, and never queues another", async () => {
    process.env.SQUARE_ACCESS_TOKEN = "test";
    process.env.SQUARE_ENVIRONMENT = "sandbox";
    try {
      const e = email();
      const account = await verifyLoginCode(e, await createLoginCode(e));
      expect(await db.outboxJob.count({ where: { dedupeKey: `${account.id}:account-sync` } })).toBe(1);

      await processOutbox({ mailer: { mode: "preview", send: async () => {} } });
      await processOutbox({ mailer: { mode: "preview", send: async () => {} } });
      const saved = await db.customer.findUniqueOrThrow({ where: { id: account.id } });
      expect(saved.squareCustomerId).toMatch(/^SQ_/);
      expect(square.customers.create).toHaveBeenCalledTimes(1);

      // Signing in again doesn't sync (or create) again.
      await verifyLoginCode(e, await createLoginCode(e));
      expect(await db.outboxJob.count({ where: { dedupeKey: `${account.id}:account-sync` } })).toBe(1);
      expect(square.customers.create).toHaveBeenCalledTimes(1);
    } finally {
      delete process.env.SQUARE_ACCESS_TOKEN;
      delete process.env.SQUARE_ENVIRONMENT;
    }
  });
});
