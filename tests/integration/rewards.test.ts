/** Coastline Rewards: 2 points per $1 on picked-up orders, traded for prizes. */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPaidOrder } from "../helpers/fixtures";

const { db } = await import("@/lib/db");
const { changeOrderStatus } = await import("@/lib/orders/admin");
const { pointsFor, rewardsSummary, redeemPrize, RedeemError } = await import("@/lib/rewards/server");

const email = () => `${randomUUID().slice(0, 8)}@example.com`;

async function orderFor(e: string) {
  const order = await createPaidOrder();
  return db.order.update({ where: { id: order.id }, data: { customerEmail: e, customerOrderCount: 2 } });
}

describe("earning points", () => {
  it("gives 2 points per dollar, rounded down", () => {
    expect(pointsFor(1999)).toBe(39);
    expect(pointsFor(2000)).toBe(40);
    expect(pointsFor(0)).toBe(0);
  });

  it("adds them once, when the order is picked up, and shows them as pending before that", async () => {
    const e = email();
    const order = await orderFor(e);
    const expected = pointsFor(order.totalCents + order.giftCardCents);
    expect(await rewardsSummary(e)).toMatchObject({ balance: 0, pending: expected });

    await changeOrderStatus(order.id, "PICKED_UP");
    expect(await rewardsSummary(e)).toMatchObject({ balance: expected, pending: 0 });

    // Moving it back and picking it up again doesn't add them twice.
    await changeOrderStatus(order.id, "READY_FOR_PICKUP");
    await changeOrderStatus(order.id, "PICKED_UP");
    expect((await rewardsSummary(e)).balance).toBe(expected);
  });
});

describe("prizes", () => {
  async function customerWith(points: number) {
    const e = email();
    const c = await db.customer.create({ data: { email: e } });
    await db.pointsEntry.create({ data: { email: e, points, kind: "EARN" } });
    return c;
  }

  it("won't redeem without enough points", async () => {
    const c = await customerWith(150);
    await expect(redeemPrize(c, "five-off")).rejects.toBeInstanceOf(RedeemError);
  });

  it("turns points into a one-use coupon locked to the account", async () => {
    const c = await customerWith(250);
    const r = await redeemPrize(c, "five-off");
    expect(r.balance).toBe(50);
    const coupon = await db.promoCode.findFirstOrThrow({ where: { ownerId: c.id } });
    expect(coupon).toMatchObject({ kind: "AMOUNT", amountCents: 500, maxUses: 1 });
    expect((await rewardsSummary(c.email)).balance).toBe(50);
  });

  it("makes the gift card prize unlocked, with a PIN, so it can be given away", async () => {
    const c = await customerWith(700);
    const r = await redeemPrize(c, "gift-ten");
    expect(r.pin).toMatch(/^CP\d{5}$/);
    const card = await db.promoCode.findFirstOrThrow({ where: { code: r.number.replace(/\s/g, "") } });
    expect(card).toMatchObject({ kind: "GIFT_CARD", balanceCents: 1000, ownerId: null });
  });

  it("can't spend the same points twice with two quick taps", async () => {
    const c = await customerWith(250);
    const results = await Promise.allSettled([redeemPrize(c, "five-off"), redeemPrize(c, "five-off")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await rewardsSummary(c.email)).balance).toBe(50);
  });
});
