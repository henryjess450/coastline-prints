/**
 * Real end-to-end checkout against the Square SANDBOX. Skipped unless
 * SQUARE_ACCESS_TOKEN, SQUARE_APPLICATION_ID and SQUARE_LOCATION_ID are set
 * (sandbox credentials only). Uses Square's published test nonces, so no
 * card form is needed:
 *   cnon:card-nonce-ok        → approved
 *   cnon:card-nonce-declined  → declined
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cartItem, cubeUpload, customer, jsonRequest, validPickup } from "../helpers/fixtures";

const configured = !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_APPLICATION_ID && process.env.SQUARE_LOCATION_ID);
const isSandbox = process.env.SQUARE_ENVIRONMENT !== "production";

describe.skipIf(!configured || !isSandbox)("Square sandbox checkout", () => {
  it("charges a test card and creates the order", async () => {
    // .env provides the real location id; the unit-test default is overridden here.
    const { POST: checkout } = await import("@/app/api/checkout/route");
    const { POST: quote } = await import("@/app/api/quote/route");
    const { db } = await import("@/lib/db");
    const up = await cubeUpload();
    const items = [cartItem(up.id)];
    const q = await (await quote(jsonRequest("http://test/api/quote", { items }))).json();

    const res = await checkout(jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "cnon:card-nonce-ok", customer, items, expectedTotalCents: q.quote.totalCents, pickup: await validPickup() }));
    const data = await res.json();
    expect(res.status, JSON.stringify(data)).toBe(200);
    const order = await db.order.findUniqueOrThrow({ where: { orderNumber: data.orderNumber } });
    expect(order.squarePaymentId).toBeTruthy();
    expect(order.receiptUrl).toMatch(/^https:\/\//);
  }, 30_000);

  it("a declined test card creates no order", async () => {
    const { POST: checkout } = await import("@/app/api/checkout/route");
    const { POST: quote } = await import("@/app/api/quote/route");
    const { db } = await import("@/lib/db");
    const up = await cubeUpload();
    const items = [cartItem(up.id)];
    const q = await (await quote(jsonRequest("http://test/api/quote", { items }))).json();
    const before = await db.order.count();
    const res = await checkout(jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "cnon:card-nonce-declined", customer, items, expectedTotalCents: q.quote.totalCents, pickup: await validPickup() }));
    expect(res.status).toBe(402);
    expect(await db.order.count()).toBe(before);
  }, 30_000);
});
