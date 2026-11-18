/** Rewards at the stand (register and kiosk): find by phone or email, spend points on this sale, undo; and the admin editing or deleting a customer. */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPaidOrder } from "../helpers/fixtures";

const { db } = await import("@/lib/db");
const { findRewardsCustomer, redeemForSale, undoStandRedeem, rewardsRef, emailFromRef, maskEmail } = await import("@/lib/rewards/stand");
const { RedeemError } = await import("@/lib/rewards/server");
const { updateCustomer, deleteCustomer, CustomerEditError } = await import("@/lib/admin/customers");
const { lookupCodes } = await import("@/lib/codes/server");

const email = () => `${randomUUID().slice(0, 8)}@example.com`;
const phone = () => `250${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
const give = (e: string, points: number) => db.pointsEntry.create({ data: { email: e, points, kind: "ADJUST" } });

describe("finding someone at the stand", () => {
  it("finds an account by its phone however it's typed, or by email", async () => {
    const e = email();
    const p = phone();
    await db.customer.create({ data: { email: e, name: "Sam Rivera", phone: `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` } });
    await give(e, 450);
    const byPhone = await findRewardsCustomer(`+1 ${p}`);
    expect(byPhone).toMatchObject({ email: e, name: "Sam Rivera", hasAccount: true, points: 450 });
    expect(byPhone!.prizes.filter((x) => x.affordable).map((x) => x.id)).toEqual(["five-off"]);
    expect((await findRewardsCustomer(e.toUpperCase()))?.email).toBe(e);
  });

  it("finds someone without an account by the phone on their last order, and nobody for a stranger", async () => {
    const e = email();
    const p = phone();
    const order = await createPaidOrder();
    await db.order.update({ where: { id: order.id }, data: { customerEmail: e, customerPhone: p, customerName: "Jo Park" } });
    expect(await findRewardsCustomer(p)).toMatchObject({ email: e, name: "Jo Park", hasAccount: false, points: 0 });
    expect(await findRewardsCustomer(phone())).toBeNull();
    expect(await findRewardsCustomer("nobody-here@example.com")).toBeNull();
    expect(await findRewardsCustomer("12")).toBeNull();
  });
});

describe("the kiosk's hidden email", () => {
  it("only shows part of the email, and the signed ref gives the real one back until it expires", () => {
    expect(maskEmail("sam.rivera@example.com")).toBe("s•••@example.com");
    const ref = rewardsRef("sam@example.com", 1_000);
    expect(emailFromRef(ref, 2_000)).toBe("sam@example.com");
    expect(emailFromRef(ref, 1_000 + 31 * 60_000)).toBeNull();
    const [body, sig] = ref.split(".");
    const forged = `${Buffer.from("eve@example.com|99999999999999").toString("base64url")}.${sig}`;
    expect(emailFromRef(forged, 2_000)).toBeNull();
    expect(emailFromRef(`${body}.x`, 2_000)).toBeNull();
    expect(emailFromRef("", 2_000)).toBeNull();
  });
});

describe("spending points on a sale", () => {
  it("makes a one-use coupon anyone at the register can apply, and undoing gives the points back", async () => {
    const e = email();
    await give(e, 250);
    const r = await redeemForSale(e, "five-off");
    expect(r).toMatchObject({ label: "$5 off", balance: 50 });
    const { records, errors } = await lookupCodes([r.code], new Date(), null, null, { channel: "market" });
    expect(errors).toEqual([]);
    expect(records[0]).toMatchObject({ kind: "AMOUNT", amountCents: 500, maxUses: 1 });

    await expect(redeemForSale(e, "five-off")).rejects.toBeInstanceOf(RedeemError);
    await expect(redeemForSale(e, "gift-ten")).rejects.toBeInstanceOf(RedeemError);

    expect(await undoStandRedeem(r.code)).toBe(true);
    expect(await db.promoCode.findUnique({ where: { code: r.code } })).toBeNull();
    expect((await findRewardsCustomer(e))?.points).toBe(250);
  });

  it("won't undo a coupon that was used, or one that isn't a stand prize", async () => {
    const e = email();
    await give(e, 200);
    const r = await redeemForSale(e, "five-off");
    await db.promoCode.update({ where: { code: r.code }, data: { uses: 1 } });
    expect(await undoStandRedeem(r.code)).toBe(false);
    expect((await findRewardsCustomer(e))?.points).toBe(0);
    const other = await db.promoCode.create({ data: { code: `T${randomUUID().slice(0, 8).toUpperCase()}`, kind: "AMOUNT", amountCents: 500 } });
    expect(await undoStandRedeem(other.code)).toBe(false);
  });
});

describe("admin: editing and deleting a customer", () => {
  it("edits details, and a new email takes their points and orders with it", async () => {
    const e = email();
    const account = await db.customer.create({ data: { email: e, name: "Old Name" } });
    await give(e, 300);
    const order = await createPaidOrder();
    await db.order.update({ where: { id: order.id }, data: { customerEmail: e } });
    const moved = email();
    await updateCustomer(e, { email: moved, name: "New Name", phone: "250 555 0199", news: false });
    expect(await db.customer.findUnique({ where: { id: account.id } })).toMatchObject({ email: moved, name: "New Name", phone: "250 555 0199", emailOptOut: true });
    expect((await findRewardsCustomer(moved))?.points).toBe(300);
    expect((await db.order.findUnique({ where: { id: order.id } }))?.customerEmail).toBe(moved);

    const taken = await db.customer.create({ data: { email: email() } });
    await expect(updateCustomer(moved, { email: taken.email, name: "", phone: "", news: true })).rejects.toBeInstanceOf(CustomerEditError);
  });

  it("deletes the account and points but keeps orders, and switches off coupons saved to it", async () => {
    const e = email();
    const account = await db.customer.create({ data: { email: e } });
    await give(e, 500);
    const order = await createPaidOrder();
    await db.order.update({ where: { id: order.id }, data: { customerEmail: e } });
    const coupon = await db.promoCode.create({ data: { code: `T${randomUUID().slice(0, 8).toUpperCase()}`, kind: "AMOUNT", amountCents: 500, ownerId: account.id } });
    await deleteCustomer(e);
    expect(await db.customer.findUnique({ where: { id: account.id } })).toBeNull();
    expect(await db.pointsEntry.count({ where: { email: e } })).toBe(0);
    expect(await db.order.findUnique({ where: { id: order.id } })).not.toBeNull();
    const after = await db.promoCode.findUnique({ where: { id: coupon.id } });
    expect(after?.ownerId).toBeNull();
    expect(after!.expiresAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
