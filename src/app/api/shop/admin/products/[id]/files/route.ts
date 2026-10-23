import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError, logError } from "@/lib/api";
import { db } from "@/lib/db";
import { fileExt, productFiles } from "@/lib/shop/files";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

/** Admin: add print files (STL, 3MF...) to a shop product. Kept private, never shown on the shop. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!requestIsAdmin(req)) return apiError(401, "Please log in again.");
  const { id } = await ctx.params;
  const product = await db.shopProduct.findUnique({ where: { id }, select: { id: true } });
  if (!product) return apiError(404, "That product doesn't exist any more.");
  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
  if (!files.length) return apiError(400, "No file was sent.");
  for (const f of files) {
    if (!productFiles.extensions.includes(fileExt(f.name))) return apiError(415, `${f.name}: use ${productFiles.extensions.map((e) => e.toUpperCase()).join(", ")}.`);
    if (f.size > productFiles.maxMb * 1024 * 1024) return apiError(413, `${f.name} is over ${productFiles.maxMb} MB.`);
  }
  try {
    const saved = [];
    for (const f of files) {
      const key = `shop-files/${randomBytes(12).toString("hex")}.${fileExt(f.name)}`;
      await getStorage().put(key, new Uint8Array(await f.arrayBuffer()));
      saved.push(await db.shopProductFile.create({ data: { productId: id, fileName: f.name.slice(0, 200), storageKey: key, sizeBytes: f.size } }));
    }
    return NextResponse.json({ files: saved.map((s) => ({ id: s.id, fileName: s.fileName, sizeBytes: s.sizeBytes, createdAt: s.createdAt.toISOString() })) });
  } catch (err) {
    logError("shop:file-upload", err);
    return apiError(500, "Couldn't save the file.");
  }
}
