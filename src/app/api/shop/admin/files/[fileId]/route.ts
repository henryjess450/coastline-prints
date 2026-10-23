import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

/** Admin: download one of a product's print files. */
export async function GET(req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  if (!requestIsAdmin(req)) return apiError(401, "Please log in again.");
  const f = await db.shopProductFile.findUnique({ where: { id: (await ctx.params).fileId } });
  if (!f) return apiError(404, "File not found.");
  const data = await getStorage().get(f.storageKey).catch(() => null);
  if (!data) return apiError(404, "The file is missing from storage.");
  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Admin: delete one of a product's print files. */
export async function DELETE(req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  if (!requestIsAdmin(req)) return apiError(401, "Please log in again.");
  const f = await db.shopProductFile.findUnique({ where: { id: (await ctx.params).fileId } });
  if (!f) return new Response(null, { status: 204 });
  await db.shopProductFile.delete({ where: { id: f.id } });
  await getStorage().delete(f.storageKey);
  return new Response(null, { status: 204 });
}
