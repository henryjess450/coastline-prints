/**
 * Account settings: saved details, light or dark, and moving an account to a
 * new email (confirmed by a code, taking its orders and points along). The
 * Square update never makes a duplicate customer. Square is faked.
 */
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SquareError } from "square";
import { createPaidOrder } from "../helpers/fixtures";

const square = { customers: { search: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn() } };
vi.mock("@/lib/square/client", () => ({ getSquare: () => square, squareLocationId: () => "LOC", squarePublicConfig: () => null }));

const { db } = await import("@/lib/db");
const { createLoginCode, verifyLoginCode, LoginError } = await import("@/lib/account/auth");
const { profileFor, updateProfile, startEmailChange, finishEmailChange, rememberOrderDetails, firstName } = await import("@/lib/account/profile");
const { updateSquareCustomer } = await import("@/lib/square/customers");

const email = () => `${randomUUID().slice(0, 8)}@example.com`;
const account = (e = email(), data: Record<string, unknown> = {}) => db.customer.create({ data: { email: e, ...data } });

beforeEach(() => {
  square.customers.search.mockReset().mockResolvedValue({ customers: [] });
  square.customers.get.mockReset();
  square.customers.update.mockReset().mockResolvedValue({ customer: {} });
  square.customers.create.mockReset().mockImplementation(async () => ({ customer: { id: `SQ_${randomUUID().slice(0, 6)}` } }));
});

describe("saved shipping address", () => {
  const addr = { name: "Sam Rivers", line1: "1 Main Street", line2: "", city: "Halifax", province: "NS", postal: "B3H 1A1" };

  it("is saved from their first shipped order, and kept after that", async () => {
    const a = await account();
    expect((await profileFor(a)).address).toBeNull();
    await rememberOrderDetails(a.id, a.email, { name: "Sam", phone: "604 555 0123" }, addr);
    expect((await profileFor(await db.customer.findUniqueOrThrow({ where: { id: a.id } }))).address).toEqual(addr);
    // A later order to somewhere else doesn't replace the one they have.
    await rememberOrderDetails(a.id, a.email, { name: "Sam", phone: "604 555 0123" }, { ...addr, city: "Truro" });
    expect((await profileFor(await db.customer.findUniqueOrThrow({ where: { id: a.id } }))).address?.city).toBe("Halifax");
  });

  it("can be changed and removed in settings", async () => {
    const a = await account();
    await updateProfile(a, { address: { ...addr, city: "Dartmouth" } });
    const b = await db.customer.findUniqueOrThrow({ where: { id: a.id } });
    expect((await profileFor(b)).address?.city).toBe("Dartmouth");
    await updateProfile(b, { address: null });
    expect((await profileFor(await db.customer.findUniqueOrThrow({ where: { id: a.id } }))).address).toBeNull();
  });
});

describe("saved details", () => {
  it("falls back to the latest order's name and phone until they set their own", async () => {
    const order = await createPaidOrder();
    const a = await account();
    await db.order.update({ where: { id: order.id }, data: { customerEmail: a.email } });
    expect(await profileFor(a)).toMatchObject({ name: order.customerName, phone: order.customerPhone, theme: null });
    await updateProfile(a, { name: "Robin Shore", phone: "778 555 0100", theme: "light" });
    const saved = await db.customer.findUniqueOrThrow({ where: { id: a.id } });
    expect(await profileFor(saved)).toMatchObject({ name: "Robin Shore", phone: "778 555 0100", theme: "light" });
    expect(firstName({ name: "Robin Shore", email: a.email })).toBe("Robin");
  });

  it("fills in a missing name and phone from a signed-in order, but never overwrites them", async () => {
    const a = await account(email(), { name: "Kept Name" });
    await rememberOrderDetails(a.id, a.email, { name: "Other Name", phone: "604 555 0123" });
    expect(await db.customer.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ name: "Kept Name", phone: "604 555 0123" });
  });
});

describe("changing email", () => {
  it("moves the account, its orders and its points once the new address is confirmed", async () => {
    const order = await createPaidOrder();
    const a = await account();
    await db.order.update({ where: { id: order.id }, data: { customerEmail: a.email } });
    await db.pointsEntry.create({ data: { email: a.email, points: 40, kind: "EARN" } });
    const next = email();
    const { code } = await startEmailChange(a, next.toUpperCase());
    expect(await finishEmailChange(a, next, code)).toBe(next);
    expect((await db.customer.findUniqueOrThrow({ where: { id: a.id } })).email).toBe(next);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).customerEmail).toBe(next);
    expect(await db.pointsEntry.count({ where: { email: next } })).toBe(1);
    await expect(finishEmailChange(a, next, code)).rejects.toBeInstanceOf(LoginError); // single use
  });

  it("keeps change codes and sign-in codes apart", async () => {
    const a = await account();
    const next = email();
    const { code } = await startEmailChange(a, next);
    await expect(verifyLoginCode(next, code)).rejects.toBeInstanceOf(LoginError);
    const signIn = await createLoginCode(next);
    await expect(finishEmailChange(a, next, signIn)).rejects.toBeInstanceOf(LoginError);
  });

  it("refuses an email that already has an account, or their own", async () => {
    const a = await account();
    const b = await account();
    await expect(startEmailChange(a, b.email)).rejects.toThrow(/already has its own account/);
    await expect(startEmailChange(a, a.email)).rejects.toThrow(/already your email/);
  });
});

describe("updating the Square customer", () => {
  const details = { name: "Robin Shore", email: "", phone: "778 555 0100" };

  it("updates the linked Square customer in place", async () => {
    const id = await updateSquareCustomer({ ...details, email: email(), squareCustomerId: "SQ_MINE" });
    expect(id).toBe("SQ_MINE");
    expect(square.customers.update).toHaveBeenCalledWith(expect.objectContaining({ customerId: "SQ_MINE", givenName: "Robin", familyName: "Shore", phoneNumber: "+17785550100" }));
    expect(square.customers.create).not.toHaveBeenCalled();
  });

  it("uses the Square customer that already has the new email instead of making another", async () => {
    square.customers.search.mockResolvedValue({ customers: [{ id: "SQ_ALREADY" }] });
    expect(await updateSquareCustomer({ ...details, email: email(), squareCustomerId: "SQ_MINE" })).toBe("SQ_ALREADY");
    expect(square.customers.create).not.toHaveBeenCalled();
  });

  it("finds or creates once when the old Square customer was deleted", async () => {
    square.customers.update.mockRejectedValue(new SquareError({ statusCode: 404, body: { errors: [{ category: "INVALID_REQUEST_ERROR", code: "NOT_FOUND" }] } }));
    const id = await updateSquareCustomer({ ...details, email: email(), squareCustomerId: "SQ_GONE" });
    expect(id).toMatch(/^SQ_/);
    expect(square.customers.create).toHaveBeenCalledTimes(1);
  });
});
