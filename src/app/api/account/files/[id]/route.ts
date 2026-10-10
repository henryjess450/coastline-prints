import { customerFromRequest } from "@/lib/account/auth";
import { apiError, logError } from "@/lib/api";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

/** A file from one of your own orders (for "Print it again" and your models). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const account = await customerFromRequest(req);
  if (!account) return apiError(401, "Please sign in again.");
  const { id } = await ctx.params;
  const upload = await db.upload.findFirst({ where: { id, orderItems: { some: { order: { customerEmail: account.email } } } } });
  if (!upload) return apiError(404, "File not found.");
  if (upload.fileDeletedAt) return apiError(410, "This file has been removed.");
  try {
    const bytes = await getStorage().get(upload.storageKey);
    return new Response(Buffer.from(bytes), {
      headers: { "Content-Type": "application/octet-stream", "Content-Length": String(bytes.byteLength), "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("account:file", err);
    return apiError(404, "The file is missing.");
  }
}
