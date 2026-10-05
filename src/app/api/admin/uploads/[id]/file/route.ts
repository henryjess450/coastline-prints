import { apiError, logError } from "@/lib/api";
import { requestIsAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

/** Original STL for an order item. Admin only. `?inline=1` for the 3D preview. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const { id } = await ctx.params;
  const upload = await db.upload.findUnique({ where: { id } });
  if (!upload) return apiError(404, "File not found.");
  if (upload.fileDeletedAt) return apiError(410, "This file was deleted by the retention cleanup.");
  try {
    const bytes = await getStorage().get(upload.storageKey);
    const inline = new URL(req.url).searchParams.get("inline") === "1";
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "model/stl",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${upload.safeName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    logError("admin:file", err);
    return apiError(404, "The file is missing from storage.");
  }
}
