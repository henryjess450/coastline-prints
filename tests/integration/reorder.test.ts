/** "Print it again": only your own orders, with their settings and files. */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPaidOrder } from "../helpers/fixtures";

const { db } = await import("@/lib/db");
const { getStorage } = await import("@/lib/storage");
const { GET: reorder } = await import("@/app/api/account/orders/[token]/reorder/route");
const { GET: file } = await import("@/app/api/account/files/[id]/route");
const { GET: model } = await import("@/app/api/account/models/[id]/route");

/** A signed-in request for an account with this email. */
async function asAccount(email: string) {
  const c = await db.customer.upsert({ where: { email }, update: {}, create: { email } });
  const token = randomBytes(24).toString("base64url");
  await db.customerSession.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), customerId: c.id, expiresAt: new Date(Date.now() + 86_400_000) } });
  return (url: string) => new Request(url, { headers: { cookie: `cp_account=${token}` } });
}

const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

describe("print it again", () => {
  it("gives the owner their order's files and settings", async () => {
    const order = await createPaidOrder();
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id }, include: { upload: true } });
    await getStorage().put(item.upload.storageKey, new Uint8Array([1, 2, 3]));
    const req = await asAccount(order.customerEmail);

    const res = await reorder(req("http://test/x"), params({ token: order.viewToken }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0]).toMatchObject({ material: item.material, colorId: item.colorId, quantity: item.quantity, quality: item.quality, infill: item.infill, colorMap: null });
    expect(body.items[0].upload.id).toBe(item.uploadId);

    const f = await file(req("http://test/x"), params({ id: item.uploadId }));
    expect(f.status).toBe(200);
    expect(new Uint8Array(await f.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("refuses anyone else, and anyone signed out", async () => {
    const order = await createPaidOrder();
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const stranger = await asAccount(`someone-${randomUUID().slice(0, 6)}@example.com`);
    expect((await reorder(stranger("http://test/x"), params({ token: order.viewToken }))).status).toBe(404);
    expect((await file(stranger("http://test/x"), params({ id: item.uploadId }))).status).toBe(404);
    expect((await reorder(new Request("http://test/x"), params({ token: order.viewToken }))).status).toBe(401);
  });

  it("puts one of your models back with how you last ordered it, and only yours", async () => {
    const order = await createPaidOrder();
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const res = await model((await asAccount(order.customerEmail))("http://test/x"), params({ id: item.uploadId }));
    expect(res.status).toBe(200);
    expect((await res.json()).items[0]).toMatchObject({ material: item.material, colorId: item.colorId, quantity: 1 });
    const stranger = await asAccount(`someone-${randomUUID().slice(0, 6)}@example.com`);
    expect((await model(stranger("http://test/x"), params({ id: item.uploadId }))).status).toBe(404);
  });

  it("says so when the files have been removed", async () => {
    const order = await createPaidOrder();
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    await db.upload.update({ where: { id: item.uploadId }, data: { fileDeletedAt: new Date() } });
    const req = await asAccount(order.customerEmail);
    const res = await reorder(req("http://test/x"), params({ token: order.viewToken }));
    expect(res.status).toBe(410);
  });
});
