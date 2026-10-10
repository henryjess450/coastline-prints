/** Invite a friend: one code per account, first orders only, points to the sharer when the friend pays. */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { invite } from "@config/rewards";
import { cartItem, cubeUpload } from "../helpers/fixtures";

const { db } = await import("@/lib/db");
const { inviteCodeFor, inviteStats, inviteStem } = await import("@/lib/rewards/invite");
const { lookupCodes } = await import("@/lib/codes/server");
const { rewardsSummary } = await import("@/lib/rewards/server");

const email = () => `${randomUUID().slice(0, 8)}@example.com`;
const account = (name: string | null = "Sam Rivers") => db.customer.create({ data: { email: email(), name } });

/** A paid order through the real finalize path, using these codes. */
async function paidOrder(customerEmail: string, codes: { code: string; amountCents: number }[] = []) {
  const { priceCart } = await import("@/lib/pricing/server-quote");
  const { finalizeCheckout } = await import("@/lib/orders/finalize");
  const up = await cubeUpload();
  const priced = await priceCart([cartItem(up.id)] as never);
  const { config: _c, ...quote } = priced;
  void _c;
  const off = codes.reduce((n, c) => n + c.amountCents, 0);
  const co = await db.checkout.create({
    data: {
      idempotencyKey: randomUUID(),
      cart: JSON.stringify({ lines: priced.lines, quote }),
      totalCents: priced.totalCents - off,
      discountCents: off,
      appliedCodes: JSON.stringify(codes.map((c) => ({ ...c, kind: "AMOUNT", label: `Coupon ${c.code}` }))),
      customerName: "Friend",
      customerEmail,
      customerPhone: "604 555 0123",
      squareCustomerId: "dev-preview-not-real",
      pickupDate: "2026-10-10",
      pickupTime: "17:00",
    },
  });
  const r = await finalizeCheckout(co.id, { id: `pay_${co.id}`, status: "COMPLETED", amountCents: priced.totalCents - off, currency: "CAD" });
  return r!.order;
}

describe("invite codes", () => {
  it("makes one code per account, from their first name", async () => {
    const sam = await account();
    const a = await inviteCodeFor(sam);
    const b = await inviteCodeFor(sam);
    expect(a.id).toBe(b.id);
    expect(a.code).toMatch(/^SAM[2-9][A-Z][2-9][A-Z]$/);
    expect(a.amountCents).toBe(invite.friendCents);
    expect(a.maxUses).toBeNull();
    expect(inviteStem(null, "jo.ann-99@x.com")).toBe("JOANN");
    expect(inviteStem("Zoë", "z@x.com")).toBe("ZOE");
    expect(inviteStem(null, "123@x.com")).toBe("FRIEND");
  });

  it("works for a new friend, but not for the sharer or anyone who has ordered before", async () => {
    const sam = await account();
    const { code } = await inviteCodeFor(sam);

    expect((await lookupCodes([code], new Date(), null, email())).records).toHaveLength(1);
    expect((await lookupCodes([code], new Date(), null, null)).records).toHaveLength(1); // email not known yet

    const own = await lookupCodes([code], new Date(), sam.id, null);
    expect(own.errors[0].reason).toMatch(/your own invite code/);
    expect((await lookupCodes([code], new Date(), null, sam.email)).errors[0].reason).toMatch(/your own/);

    const regular = email();
    await paidOrder(regular);
    expect((await lookupCodes([code], new Date(), null, regular)).errors[0].reason).toMatch(/first order/);
    // Signed in to an account that has ordered, even when typing a different email.
    const signedIn = await db.customer.create({ data: { email: regular.replace("@", "+acct@") } });
    await paidOrder(signedIn.email);
    expect((await lookupCodes([code], new Date(), signedIn.id, email())).errors[0].reason).toMatch(/first order/);
  });
});

describe("points for the sharer", () => {
  it("adds the points as soon as the friend's first order is paid, once", async () => {
    const sam = await account();
    const { code } = await inviteCodeFor(sam);
    const order = await paidOrder(email(), [{ code, amountCents: invite.friendCents }]);

    const entry = await db.pointsEntry.findUniqueOrThrow({ where: { inviteOrderId: order.id } });
    expect(entry).toMatchObject({ email: sam.email, points: invite.points, kind: "INVITE" });
    expect(await inviteStats(sam.email)).toEqual({ friends: 1, points: invite.points });

    const summary = await rewardsSummary(sam.email);
    expect(summary.balance).toBe(invite.points);
    expect(summary.history[0].label).toBe("A friend you invited ordered");
  });

  it("gives nothing for a friend's second order, or for orders without the code", async () => {
    const sam = await account();
    const { code } = await inviteCodeFor(sam);
    const friend = email();
    await paidOrder(friend);
    await paidOrder(friend, [{ code, amountCents: invite.friendCents }]); // slipped past checkout somehow
    await paidOrder(email()); // no code
    expect(await inviteStats(sam.email)).toEqual({ friends: 0, points: 0 });
  });
});
