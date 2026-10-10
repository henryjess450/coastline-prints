import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { checkCredentials, createSessionToken, verifySessionToken } from "@/lib/admin/auth";
import { cleanupFiles } from "@/lib/cleanup";
import { getEffectiveConfig } from "@/lib/config/effective";
import { resetSetting, saveMaterials, savePricing } from "@/lib/config/save";
import { db } from "@/lib/db";
import { changeOrderStatus, StatusChangeError } from "@/lib/orders/admin";
import { findOrderForCustomer } from "@/lib/orders/lookup";
import { createPaidOrder, cubeUpload } from "../helpers/fixtures";

describe("admin login", () => {
  it("accepts only the configured credentials", () => {
    expect(checkCredentials("owner", "correct horse battery staple")).toBe(true);
    expect(checkCredentials("owner", "wrong")).toBe(false);
    expect(checkCredentials("someone", "correct horse battery staple")).toBe(false);
  });

  it("session tokens verify, expire, and can't be forged", () => {
    const t = createSessionToken();
    expect(verifySessionToken(t)).toBe(true);
    expect(verifySessionToken(t, Date.now() + 15 * 86_400_000)).toBe(false); // past 14 days
    const [payload] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "owner", exp: Date.now() + 1e12 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${t.split(".")[1]}`)).toBe(false);
    expect(verifySessionToken(`${payload}.not-a-signature`)).toBe(false);
    expect(verifySessionToken(undefined)).toBe(false);
  });

  it("changing the admin password invalidates old sessions", () => {
    const t = createSessionToken();
    const old = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = "a new password";
    expect(verifySessionToken(t)).toBe(false);
    process.env.ADMIN_PASSWORD = old;
    expect(verifySessionToken(t)).toBe(true);
  });
});

describe("status pipeline", () => {
  beforeEach(async () => {
    await db.outboxJob.deleteMany();
  });

  it("records history and only emails when asked", async () => {
    const order = await createPaidOrder();
    await db.outboxJob.deleteMany();
    const r = await changeOrderStatus(order.id, "QUEUED");
    expect(r).toMatchObject({ from: "PAID", to: "QUEUED", notified: false });
    expect(await db.outboxJob.count()).toBe(0);

    await changeOrderStatus(order.id, "PRINTING", { notify: true, note: "Starting now" });
    const job = await db.outboxJob.findFirstOrThrow();
    expect(job.template).toBe("status-update");
    expect(JSON.parse(job.payload)).toMatchObject({ orderId: order.id, note: "Starting now" });

    const events = await db.orderStatusEvent.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.toStatus)).toEqual(["PAID", "QUEUED", "PRINTING"]);
    expect(events[2]).toMatchObject({ fromStatus: "QUEUED", customerNotified: true, note: "Starting now" });
  });

  it("ready for pickup always emails the customer", async () => {
    const order = await createPaidOrder();
    await db.outboxJob.deleteMany();
    const r = await changeOrderStatus(order.id, "READY_FOR_PICKUP", { notify: false });
    expect(r.notified).toBe(true);
    expect((await db.outboxJob.findFirstOrThrow()).template).toBe("ready-for-pickup");
  });

  it("shipping an order emails the tracking number, never the pickup address", async () => {
    const order = await createPaidOrder({ ship: true });
    await db.outboxJob.deleteMany();
    await expect(changeOrderStatus(order.id, "READY_FOR_PICKUP", { trackingNumber: "12 3" })).rejects.toThrow(/tracking/);
    await changeOrderStatus(order.id, "READY_FOR_PICKUP", { trackingNumber: "7023 2104 1234 5678" });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).trackingNumber).toBe("7023210412345678");
    expect((await db.outboxJob.findFirstOrThrow()).template).toBe("shipped");

    const { buildEmail } = await import("@/lib/email/build");
    const { loadOrderEmailData } = await import("@/lib/email/data");
    const d = (await loadOrderEmailData(order.id))!;
    // Even if a pickup email were queued by mistake, a shipped order gets the shipped one.
    for (const template of ["shipped", "ready-for-pickup", "customer-receipt"] as const) {
      const email = await buildEmail(template, d);
      expect(email.html).not.toContain("123 Example Street");
      expect(email.html).toContain("Halifax");
    }
    expect((await buildEmail("shipped", d)).html).toContain("7023210412345678");
  });

  it("rejects unknown statuses and no-op changes", async () => {
    const order = await createPaidOrder();
    await expect(changeOrderStatus(order.id, "SHIPPED")).rejects.toThrow(StatusChangeError);
    await expect(changeOrderStatus(order.id, "PAID")).rejects.toThrow(/already/);
    await expect(changeOrderStatus("missing", "QUEUED")).rejects.toThrow(/not found/);
  });
});

describe("customer status lookup", () => {
  it("needs the matching email and never exposes private details", async () => {
    const order = await createPaidOrder();
    expect(await findOrderForCustomer(order.orderNumber, "someone@else.com")).toBeNull();
    const view = await findOrderForCustomer(order.orderNumber.toLowerCase(), "  SAM@example.com ");
    expect(view?.status).toBe("PAID");
    expect(view?.pickupWhen).toBe("Saturday, October 10, 5 to 6 pm");
    const json = JSON.stringify(view);
    for (const secret of ["123 Example Street", "604 555", "4242", "squareup.com", order.viewToken]) expect(json).not.toContain(secret);
  });
});

describe("file retention cleanup", () => {
  const storageDir = process.env.STORAGE_DIR!;
  async function fakeFile(key: string) {
    const p = path.resolve(storageDir, key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, "solid x");
  }

  it("deletes abandoned uploads after 30 days and picked-up order files after 90", async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 40 * 86_400_000);

    const abandoned = await cubeUpload();
    await db.upload.update({ where: { id: abandoned.id }, data: { createdAt: old } });
    await fakeFile(abandoned.storageKey);
    const fresh = await cubeUpload();

    const done = await createPaidOrder();
    const doneItem = await db.orderItem.findFirstOrThrow({ where: { orderId: done.id } });
    await db.upload.update({ where: { id: doneItem.uploadId }, data: { createdAt: old } });
    await changeOrderStatus(done.id, "PICKED_UP");
    await db.orderStatusEvent.updateMany({ where: { orderId: done.id, toStatus: "PICKED_UP" }, data: { createdAt: new Date(now.getTime() - 100 * 86_400_000) } });

    const active = await createPaidOrder();
    const activeItem = await db.orderItem.findFirstOrThrow({ where: { orderId: active.id } });
    await db.upload.update({ where: { id: activeItem.uploadId }, data: { createdAt: old } });

    const r = await cleanupFiles(now);
    expect(r.abandoned).toBeGreaterThanOrEqual(1);
    expect(r.expired).toBeGreaterThanOrEqual(1);
    expect(await db.upload.findUnique({ where: { id: abandoned.id } })).toBeNull();
    expect(await db.upload.findUnique({ where: { id: fresh.id } })).not.toBeNull();
    expect((await db.upload.findUniqueOrThrow({ where: { id: doneItem.uploadId } })).fileDeletedAt).not.toBeNull();
    expect(await db.order.findUnique({ where: { id: done.id } })).not.toBeNull(); // record kept
    expect((await db.upload.findUniqueOrThrow({ where: { id: activeItem.uploadId } })).fileDeletedAt).toBeNull();
  });
});

describe("settings", () => {
  it("pricing and materials overrides apply and can be reset", async () => {
    await savePricing({ baseFeeCents: 900, pricePerGramCents: 4, pricePerHourCents: 150, markupPerPieceCents: 75, minimumOrderCents: 1000 });
    const cfg = await getEffectiveConfig();
    expect(cfg.pricing.baseFeeCents).toBe(900);

    const materials = structuredClone(cfg.materials);
    materials[2].colors.push({ id: "cf-grey", name: "Carbon Grey", hex: "#555555", finish: "matte", available: true });
    await saveMaterials(materials);
    expect((await getEffectiveConfig()).materials[2].colors.map((c) => c.id)).toContain("cf-grey");

    await resetSetting("pricing");
    await resetSetting("materials");
    const back = await getEffectiveConfig();
    expect(back.pricing.baseFeeCents).toBe(750);
    expect(back.materials[2].colors.map((c) => c.id)).not.toContain("cf-grey");
  });

  it("rejects duplicate colour ids, bad hex and negative prices", async () => {
    const cfg = await getEffectiveConfig();
    const dup = structuredClone(cfg.materials);
    dup[0].colors.push({ ...dup[0].colors[0] });
    await expect(saveMaterials(dup)).rejects.toThrow(/same id/);
    const badHex = structuredClone(cfg.materials);
    badHex[0].colors[0].hex = "red";
    await expect(saveMaterials(badHex)).rejects.toThrow();
    await expect(savePricing({ ...cfg.pricing, baseFeeCents: -1 })).rejects.toThrow();
  });
});

describe("gift card PINs", () => {
  it("only works with the matching PIN", async () => {
    const { generateCode, generatePin, lookupCodes } = await import("@/lib/codes/server");
    const code = generateCode("GIFT_CARD");
    const pin = generatePin();
    expect(code).toMatch(/^[1-9]\d{15}$/);
    expect(pin).toMatch(/^CP\d{5}$/);
    await db.promoCode.create({ data: { code, pin, kind: "GIFT_CARD", initialCents: 500, balanceCents: 500 } });
    const spaced = code.replace(/(\d{4})(?=\d)/g, "$1 ");
    expect((await lookupCodes([`${spaced}:${pin.toLowerCase()}`])).records).toHaveLength(1);
    const wrong = await lookupCodes([`${code}:CP00000`]);
    expect(wrong.records).toHaveLength(0);
    expect(wrong.errors[0].reason).toBe("That code isn't valid.");
    expect((await lookupCodes([code])).records).toHaveLength(0);
  });
});

describe("gift card PIN fail-safe", () => {
  it("refuses a 16-digit card that somehow has no PIN stored", async () => {
    const { lookupCodes } = await import("@/lib/codes/server");
    await db.promoCode.create({ data: { code: "4000000000000002", kind: "GIFT_CARD", initialCents: 500, balanceCents: 500 } });
    expect((await lookupCodes(["4000000000000002"])).records).toHaveLength(0);
    expect((await lookupCodes(["4000000000000002:CP12345"])).records).toHaveLength(0);
  });
});

describe("generated coupon numbers", () => {
  it("are 12 digits and print in groups of 4", async () => {
    const { generateCode } = await import("@/lib/codes/server");
    const { formatCardNumber, normalizeCode } = await import("@/lib/codes/apply");
    const c = generateCode("AMOUNT");
    expect(c).toMatch(/^[1-9]\d{11}$/);
    expect(formatCardNumber(c)).toMatch(/^\d{4} \d{4} \d{4}$/);
    expect(normalizeCode(formatCardNumber(c))).toBe(c);
  });
});

describe("one-tap next step", () => {
  it("won't move an order that has already moved on (a double tap can't skip a step)", async () => {
    const order = await createPaidOrder();
    await changeOrderStatus(order.id, "QUEUED", { from: "PAID" });
    await expect(changeOrderStatus(order.id, "QUEUED", { from: "PAID" })).rejects.toThrow(/already/);
    await expect(changeOrderStatus(order.id, "PRINTING", { from: "PAID" })).rejects.toThrow(/already moved on/);
    expect((await changeOrderStatus(order.id, "PRINTING", { from: "QUEUED" })).to).toBe("PRINTING");
  });
});
