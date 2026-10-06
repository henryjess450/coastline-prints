/**
 * Accounts, saved (locked) gift cards and coupons, and the first-order
 * thank-you coupon, against the test database.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPaidOrder } from "../helpers/fixtures";

const { db } = await import("@/lib/db");
const { createLoginCode, verifyLoginCode, LoginError } = await import("@/lib/account/auth");
const { saveToWallet, walletFor, SaveError } = await import("@/lib/account/wallet");
const { lookupCodes, generatePin } = await import("@/lib/codes/server");
const { rewardAmountCents } = await import("@/lib/codes/rewards");
const { changeOrderStatus } = await import("@/lib/orders/admin");

const email = () => `${randomUUID().slice(0, 8)}@example.com`;
const customer = (e = email()) => db.customer.create({ data: { email: e } });
const giftCard = (cents = 2500) =>
  db.promoCode.create({ data: { code: `9${String(Math.floor(Math.random() * 1e15)).padStart(15, "0")}`, pin: generatePin(), kind: "GIFT_CARD", initialCents: cents, balanceCents: cents } });

describe("sign-in codes", () => {
  it("signs in with the right code once, and makes the account", async () => {
    const e = email();
    const code = await createLoginCode(e);
    const c = await verifyLoginCode(e, code);
    expect(c.email).toBe(e);
    await expect(verifyLoginCode(e, code)).rejects.toBeInstanceOf(LoginError); // single use
  });

  it("refuses a wrong code and locks out after five tries", async () => {
    const e = email();
    const code = await createLoginCode(e);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(verifyLoginCode(e, wrong)).rejects.toThrow(/doesn't match/);
    await expect(verifyLoginCode(e, code)).rejects.toThrow(/Too many/);
  });

  it("expires codes", async () => {
    const e = email();
    const code = await createLoginCode(e, new Date(Date.now() - 11 * 60_000));
    await expect(verifyLoginCode(e, code)).rejects.toThrow(/expired/);
  });
});

describe("saving to an account", () => {
  it("saves a gift card with its PIN and locks it to that account", async () => {
    const owner = await customer();
    const other = await customer();
    const card = await giftCard();
    await expect(saveToWallet(owner.id, card.code, "CP00000")).rejects.toBeInstanceOf(SaveError); // wrong PIN
    const item = await saveToWallet(owner.id, card.code, card.pin!);
    expect(item.kind).toBe("GIFT_CARD");
    expect((await walletFor(owner.id)).map((w) => w.code)).toEqual([card.code]);

    // Someone else can't save it or spend it, even with the PIN.
    await expect(saveToWallet(other.id, card.code, card.pin!)).rejects.toThrow(/another account/);
    expect((await lookupCodes([`${card.code}:${card.pin}`], new Date(), other.id)).errors).toHaveLength(1);
    expect((await lookupCodes([`${card.code}:${card.pin}`], new Date(), null)).errors).toHaveLength(1);
    // The owner can spend it without the PIN.
    expect((await lookupCodes([card.code], new Date(), owner.id)).records).toHaveLength(1);
  });

  it("won't lock a shared promo code to one person", async () => {
    const owner = await customer();
    const promo = await db.promoCode.create({ data: { code: `SHARED${randomUUID().slice(0, 6).toUpperCase()}`, kind: "PERCENT", percentOff: 10 } });
    await expect(saveToWallet(owner.id, promo.code)).rejects.toThrow(/shared promo code/);
  });
});

describe("first-order thank-you coupon", () => {
  it("uses the tiers", () => {
    expect(rewardAmountCents(1000)).toBe(300);
    expect(rewardAmountCents(2500)).toBe(500);
    expect(rewardAmountCents(7499)).toBe(500);
    expect(rewardAmountCents(7500)).toBe(1000);
    expect(rewardAmountCents(15000)).toBe(1000);
    expect(rewardAmountCents(15001)).toBe(2000);
  });

  it("is made once when a first order is picked up, valid 90 days, and emailed", async () => {
    const order = await createPaidOrder();
    await db.order.update({ where: { id: order.id }, data: { customerOrderCount: 1, customerEmail: email() } });
    await changeOrderStatus(order.id, "PICKED_UP");
    const coupon = await db.promoCode.findUniqueOrThrow({ where: { rewardOrderId: order.id } });
    expect(coupon).toMatchObject({ kind: "AMOUNT", maxUses: 1, amountCents: rewardAmountCents(order.totalCents + order.giftCardCents) });
    expect(coupon.code).toMatch(/^[1-9]\d{11}$/);
    const days = (coupon.expiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThan(91);
    expect(await db.outboxJob.count({ where: { dedupeKey: `${order.id}:first-order-coupon` } })).toBe(1);
  });

  it("goes straight into their account if they have one", async () => {
    const order = await createPaidOrder();
    const acct = await customer();
    await db.order.update({ where: { id: order.id }, data: { customerOrderCount: 1, customerEmail: acct.email } });
    await changeOrderStatus(order.id, "PICKED_UP");
    expect((await db.promoCode.findUniqueOrThrow({ where: { rewardOrderId: order.id } })).ownerId).toBe(acct.id);
  });

  it("isn't made for a repeat customer", async () => {
    const order = await createPaidOrder();
    await db.order.update({ where: { id: order.id }, data: { customerOrderCount: 2 } });
    await changeOrderStatus(order.id, "PICKED_UP");
    expect(await db.promoCode.findUnique({ where: { rewardOrderId: order.id } })).toBeNull();
  });
});
