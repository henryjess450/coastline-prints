import { apiError, logError } from "@/lib/api";
import { requestIsAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { giftNotePdf, renderGiftNotePng } from "@/lib/receipt/gift-note";

export const runtime = "nodejs";

/** The order's gift note as a card to print (PDF, letter at 100%), or ?png=1 for a quick look. Admin only. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const { id } = await ctx.params;
  try {
    const order = await db.order.findUnique({ where: { id }, select: { giftNote: true, orderNumber: true } });
    if (!order) return apiError(404, "Order not found.");
    if (!order.giftNote) return apiError(404, "This order has no gift note.");
    if (new URL(req.url).searchParams.get("png")) {
      return new Response(new Uint8Array(await renderGiftNotePng(order.giftNote)), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
    }
    const bytes = await giftNotePdf(order.giftNote, `Gift note ${order.orderNumber}`);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="gift-note-${order.orderNumber}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("admin:gift-note", err);
    return apiError(500, "Couldn't make the gift note.");
  }
}
