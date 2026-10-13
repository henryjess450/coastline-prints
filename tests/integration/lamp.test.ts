/**
 * The order lamp: a paid order queues its animation, the dashboard
 * settings pick which one, and /api/lamp hands it to the lamp straight away.
 */
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { customer, jsonRequest, validPickup } from "../helpers/fixtures";

const square = {
  payments: { create: vi.fn(), get: vi.fn() },
  customers: {
    search: vi.fn(async () => ({ customers: [] })),
    create: vi.fn(async () => ({ customer: { id: "SQCUST1" } })),
    get: vi.fn(async ({ customerId }: { customerId: string }) => ({ customer: { id: customerId } })),
  },
};
vi.mock("@/lib/square/client", () => ({
  getSquare: () => square,
  squareLocationId: () => "TEST_LOCATION",
  squarePublicConfig: () => ({ applicationId: "app", locationId: "TEST_LOCATION", environment: "sandbox", scriptUrl: "" }),
}));

const { POST: checkout } = await import("@/app/api/checkout/route");
const { GET: lampApi } = await import("@/app/api/lamp/route");
const { db } = await import("@/lib/db");
const { lampForSale, newLampKey, queueLamp, saveLampSettings, lampSettingsSchema } = await import("@/lib/lamp/server");

const reasons = async (sinceId: number) => (await db.lampEvent.findMany({ where: { id: { gt: sinceId } }, orderBy: { id: "asc" } })).map((e) => `${e.reason}:${e.anim}`);
const lastId = async () => (await db.lampEvent.findFirst({ orderBy: { id: "desc" } }))?.id ?? 0;
const ask = (key: string | null, query = "") => lampApi(new Request(`http://test/api/lamp?v=1${query}`, { headers: key ? { authorization: `Bearer ${key}` } : {} }));

beforeEach(async () => {
  await saveLampSettings({});
  square.payments.create.mockReset();
  square.payments.create.mockImplementation(async (req) => ({
    payment: { id: `pay_${req.idempotencyKey.slice(0, 8)}`, status: "COMPLETED", amountMoney: req.amountMoney, locationId: "TEST_LOCATION", referenceId: req.referenceId },
  }));
});

describe("order lamp", () => {
  it("plays the shop's animation when a Coastline shop order is paid", async () => {
    const before = await lastId();
    const p = await db.shopProduct.create({ data: { shop: "coastline", slug: `lamp-${randomUUID().slice(0, 8)}`, name: "Wave", priceCents: 1200, stock: null } });
    const res = await checkout(
      jsonRequest("http://test/api/checkout", { attemptId: randomUUID(), sourceId: "cnon:card-nonce-ok", customer, products: [{ productId: p.id, variantId: null, quantity: 1 }], expectedTotalCents: 1200, fulfillment: await validPickup() }),
    );
    expect(res.status).toBe(200);
    expect(await reasons(before)).toEqual(["coastline:ripple"]);
  });

  it("follows the dashboard: chosen animation, big orders, quiet hours", async () => {
    await saveLampSettings({ play: { ...lampSettingsSchema.parse({}).play, print: "swell" }, bigCents: 50_00, bigAnim: "treasure" });
    let before = await lastId();
    await lampForSale("print", 20_00);
    await lampForSale("print", 80_00);
    expect(await reasons(before)).toEqual(["print:swell", "print:swell", "print:treasure"]);

    const hour = Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hourCycle: "h23", timeZone: "America/Vancouver" }).format(new Date()));
    await saveLampSettings({ quiet: { on: true, from: hour, to: (hour + 1) % 24 } });
    before = await lastId();
    await lampForSale("gift", 25_00);
    expect(await reasons(before)).toEqual([]);
  });

  it("needs the lamp key, and doesn't replay old orders when it switches on", async () => {
    expect((await ask(null)).status).toBe(401);
    const key = await newLampKey();
    expect((await ask("lamp_notTheRightKeyAtAll1234")).status).toBe(401);
    await queueLamp(["tide"], "dash");
    const hello = await (await ask(key)).json();
    expect(hello).toMatchObject({ events: [], last: await lastId(), brightness: 40, idle: "off" });
  });

  it("answers as soon as something is queued", async () => {
    const key = await newLampKey();
    const after = await lastId();
    setTimeout(() => void queueLamp(["lighthouse"], "dash"), 200);
    const started = Date.now();
    const data = await (await ask(key, `&after=${after}`)).json();
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(data.events.map((e: { anim: string }) => e.anim)).toEqual(["lighthouse"]);
    expect(data.last).toBe(after + 1);
  });
});
