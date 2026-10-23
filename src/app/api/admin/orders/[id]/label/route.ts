import { labels } from "@config/labels";
import { apiError, logError } from "@/lib/api";
import { requestIsAdmin } from "@/lib/admin/auth";
import { loadLabels } from "@/lib/label/data";
import { isLabelDesign, renderLabelPdf, renderLabelPng } from "@/lib/label/render";
import { spotsPerSheet } from "@/lib/label/sheet";

export const runtime = "nodejs";

/**
 * Shipping labels for an order. Admin only.
 *   ?design=harbour&start=3       PDF for Avery 8168, one label per package from spot 3
 *   ?design=harbour&preview=1     PNG of the first label, for the design picker
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const { id } = await ctx.params;
  const q = new URL(req.url).searchParams;
  const designParam = q.get("design");
  const design = isLabelDesign(designParam) ? designParam : labels.designs[0].id;
  const start = Math.min(Math.max(1, Number(q.get("start")) || 1), spotsPerSheet());
  try {
    const list = await loadLabels(id);
    if (!list) return apiError(404, "This order isn't being shipped, or has no address.");
    if (q.get("preview")) {
      const png = await renderLabelPng(design, list[0]);
      return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
    }
    const pdf = await renderLabelPdf(design, list, start);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="label-${list[0].orderNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    logError("admin:label", err);
    return apiError(500, "Couldn't make the label.");
  }
}
