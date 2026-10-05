import { apiError, logError } from "@/lib/api";
import { requestIsAdmin } from "@/lib/admin/auth";
import { loadReceiptData, renderReceiptPng } from "@/lib/receipt/render";

export const runtime = "nodejs";

/** The receipt image exactly as it prints. Admin only. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const { id } = await ctx.params;
  try {
    const data = await loadReceiptData(id);
    if (!data) return apiError(404, "Order not found.");
    const png = await renderReceiptPng(data);
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("admin:receipt", err);
    return apiError(500, "Couldn't render the receipt.");
  }
}
