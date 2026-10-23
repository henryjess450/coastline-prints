import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSessionToken, SESSION_COOKIE } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { GET as download, DELETE as remove } from "@/app/api/shop/admin/files/[fileId]/route";
import { POST as upload } from "@/app/api/shop/admin/products/[id]/files/route";
import { getStorage } from "@/lib/storage";

const admin = () => ({ cookie: `${SESSION_COOKIE}=${encodeURIComponent(createSessionToken())}` });
const product = () => db.shopProduct.create({ data: { shop: "coastline", slug: `vase-${randomUUID().slice(0, 8)}`, name: "Wave vase", priceCents: 2500 } });

function uploadReq(productId: string, files: File[], headers: Record<string, string> = admin()) {
  const form = new FormData();
  for (const f of files) form.append("file", f);
  return upload(new Request(`https://coastline.test/api/shop/admin/products/${productId}/files`, { method: "POST", body: form, headers }), { params: Promise.resolve({ id: productId }) });
}

describe("shop product print files", () => {
  it("keeps STL files on the product, downloads them for the admin and deletes them", async () => {
    const p = await product();
    const stl = new File([new Uint8Array([1, 2, 3, 4])], "wave vase.stl");
    const res = await uploadReq(p.id, [stl]);
    expect(res.status).toBe(200);
    const { files } = (await res.json()) as { files: { id: string; fileName: string; sizeBytes: number }[] };
    expect(files).toMatchObject([{ fileName: "wave vase.stl", sizeBytes: 4 }]);

    const params = { params: Promise.resolve({ fileId: files[0].id }) };
    const got = await download(new Request("https://coastline.test/x", { headers: admin() }), params);
    expect(got.headers.get("content-disposition")).toContain("attachment");
    expect([...new Uint8Array(await got.arrayBuffer())]).toEqual([1, 2, 3, 4]);

    const key = (await db.shopProductFile.findUniqueOrThrow({ where: { id: files[0].id } })).storageKey;
    expect((await remove(new Request("https://coastline.test/x", { method: "DELETE", headers: admin() }), params)).status).toBe(204);
    expect(await db.shopProductFile.findUnique({ where: { id: files[0].id } })).toBeNull();
    await expect(getStorage().get(key)).rejects.toThrow();
  });

  it("is admin only and refuses other file types", async () => {
    const p = await product();
    expect((await uploadReq(p.id, [new File(["x"], "a.stl")], {})).status).toBe(401);
    expect((await uploadReq(p.id, [new File(["x"], "a.exe")])).status).toBe(415);
    const f = await db.shopProductFile.create({ data: { productId: p.id, fileName: "a.stl", storageKey: `shop-files/${randomUUID()}.stl`, sizeBytes: 1 } });
    expect((await download(new Request("https://coastline.test/x"), { params: Promise.resolve({ fileId: f.id }) })).status).toBe(401);
  });

  it("goes with its product when the product is deleted", async () => {
    const p = await product();
    await uploadReq(p.id, [new File(["solid"], "a.3mf")]);
    await db.shopProduct.delete({ where: { id: p.id } });
    expect(await db.shopProductFile.count({ where: { productId: p.id } })).toBe(0);
  });
});
