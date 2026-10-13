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

// The dashboard actions, run as a logged-in admin.
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: async () => {}, isAdmin: async () => true, requestIsAdmin: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { POST: checkout } = await import("@/app/api/checkout/route");
const { identifyLampAction, setBottomAction } = await import("@/app/admin/lamp-actions");
const { GET: lampApi } = await import("@/app/api/lamp/route");
const { db } = await import("@/lib/db");
const { lampForSale, newLampKey, queueLamp, saveLampSettings, lampSettingsSchema } = await import("@/lib/lamp/server");

const reasons = async (sinceId: number) => (await db.lampEvent.findMany({ where: { id: { gt: sinceId } }, orderBy: { id: "asc" } })).map((e) => `${e.reason}:${e.anim}:${e.value}`);
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
    expect(await reasons(before)).toEqual(["coastline:ripple:12", "coastline:payment:12"]);
  });

  it("follows the dashboard: chosen animation, big orders, quiet hours", async () => {
    await saveLampSettings({ play: { ...lampSettingsSchema.parse({}).play, print: "swell" }, bigCents: 50_00, bigAnim: "treasure" });
    let before = await lastId();
    await lampForSale("print", 20_40);
    await lampForSale("print", 80_00);
    expect(await reasons(before)).toEqual(["print:swell:20", "print:payment:20", "print:swell:80", "print:treasure:80", "print:payment:80"]);

    await saveLampSettings({ count: false });
    before = await lastId();
    await lampForSale("gift", 25_00);
    expect(await reasons(before)).toEqual(["gift:sunset:25"]);

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
    await queueLamp([{ anim: "tide" }], "dash");
    const hello = await (await ask(key)).json();
    expect(hello).toMatchObject({ events: [], last: await lastId(), brightness: 40, idle: "off" });
  });

  it("hands over new settings at once, and quiet hours turn the glow off", async () => {
    const key = await newLampKey();
    const after = await lastId();
    await saveLampSettings({ idle: "calm", brightness: 30 });
    setTimeout(() => void saveLampSettings({ idle: "calm", brightness: 70 }), 200);
    const started = Date.now();
    const data = await (await ask(key, `&after=${after}`)).json();
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(data).toMatchObject({ events: [], brightness: 70, idle: "calm" });

    const hour = Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hourCycle: "h23", timeZone: "America/Vancouver" }).format(new Date()));
    await saveLampSettings({ idle: "calm", quiet: { on: true, from: hour, to: (hour + 2) % 24 } });
    expect(await (await ask(key)).json()).toMatchObject({ idle: "off" });
    expect(await lampForSale("print", 10_00)).toBe("quiet");
  });

  it("sets the bottom from the colours: shows them, checks the two picks are neighbours", async () => {
    const key = await newLampKey();
    const after = await lastId();
    setTimeout(() => void identifyLampAction(true), 200);
    const shown = await (await ask(key, `&after=${after}`)).json();
    expect(shown).toMatchObject({ identify: true, offset: 0, reverse: false });

    expect((await setBottomAction(4, 7)).error).toMatch(/next to each other/);
    expect(await setBottomAction(4, 3)).toMatchObject({ ok: true });
    const done = await (await ask(key)).json();
    expect(done).toMatchObject({ identify: false, offset: 4, reverse: true });
    expect(await reasons(after)).toEqual(["dash:tide:null"]);

    await setBottomAction(11, 0);
    expect(await (await ask(key)).json()).toMatchObject({ offset: 11, reverse: false });
    // Saving the other settings keeps the bottom.
    await saveLampSettings({ ...(await import("@/lib/lamp/server").then((m) => m.getLampSettings())), brightness: 55 });
    expect(await (await ask(key)).json()).toMatchObject({ offset: 11, brightness: 55 });
  });

  it("answers as soon as something is queued", async () => {
    const key = await newLampKey();
    const after = await lastId();
    setTimeout(() => void queueLamp([{ anim: "payment", value: 7 }], "dash"), 200);
    const started = Date.now();
    const data = await (await ask(key, `&after=${after}`)).json();
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(data.events).toEqual([{ id: after + 1, anim: "payment", value: 7 }]);
    expect(data.last).toBe(after + 1);
  });
});
