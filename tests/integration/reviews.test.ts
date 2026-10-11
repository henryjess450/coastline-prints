/** The "how did your print turn out?" Google review email, a day after pickup. */
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createPaidOrder } from "../helpers/fixtures";

const { reviews } = await import("@config/site");
const { db } = await import("@/lib/db");
const { changeOrderStatus } = await import("@/lib/orders/admin");
const { buildReviewEmail } = await import("@/lib/reviews");

const email = () => `${randomUUID().slice(0, 8)}@example.com`;
const jobFor = (e: string) => db.outboxJob.findUnique({ where: { dedupeKey: `review-request:${e}` } });

async function orderFor(e: string) {
  const order = await createPaidOrder();
  return db.order.update({ where: { id: order.id }, data: { customerEmail: e, customerName: "Sam Rivers" } });
}

beforeAll(() => {
  reviews.googleUrl = "https://g.page/r/test/review";
});

describe("review request", () => {
  it("is queued for a day after pickup, once per customer", async () => {
    const e = email();
    const first = await orderFor(e);
    const before = Date.now();
    await changeOrderStatus(first.id, "PICKED_UP");
    const job = await jobFor(e);
    expect(job).toMatchObject({ template: "review-request", status: "PENDING" });
    expect(job!.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(before + reviews.delayHours * 3_600_000 - 1000);

    // A second order from the same person doesn't ask again.
    const second = await orderFor(e);
    await changeOrderStatus(second.id, "PICKED_UP");
    expect(await db.outboxJob.count({ where: { template: "review-request", payload: { contains: second.id } } })).toBe(0);
  });

  it("builds the email with their first name and the review link", async () => {
    const e = email();
    const order = await orderFor(e);
    await changeOrderStatus(order.id, "PICKED_UP");
    const mail = await buildReviewEmail(order.id);
    expect(mail).toMatchObject({ to: e, subject: "How did your print turn out?" });
    expect(mail!.html).toContain("Sam");
    expect(mail!.html).toContain("https://g.page/r/test/review");
  });

  it("is skipped if the order was moved back, or they opted out of emails", async () => {
    const moved = await orderFor(email());
    await changeOrderStatus(moved.id, "PICKED_UP");
    await changeOrderStatus(moved.id, "READY_FOR_PICKUP");
    expect(await buildReviewEmail(moved.id)).toBeNull();

    const e = email();
    await db.customer.create({ data: { email: e, emailOptOut: true } });
    const optedOut = await orderFor(e);
    await changeOrderStatus(optedOut.id, "PICKED_UP");
    expect(await buildReviewEmail(optedOut.id)).toBeNull();
  });

  it("isn't queued when no review link is set", async () => {
    const saved = reviews.googleUrl;
    reviews.googleUrl = "";
    try {
      const e = email();
      const order = await orderFor(e);
      await changeOrderStatus(order.id, "PICKED_UP");
      expect(await jobFor(e)).toBeNull();
    } finally {
      reviews.googleUrl = saved;
    }
  });
});
