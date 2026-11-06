import { PDFDocument } from "pdf-lib";
import { apiError, logError } from "@/lib/api";
import { requestIsAdmin } from "@/lib/admin/auth";
import { getTagSize, renderTagPng, tagLookFor } from "@/lib/receipt/price-tag";

export const runtime = "nodejs";

/** Letter paper with quarter-inch margins (fine on home printers). Tags touch, so each border is one cut. */
const PAGE = { w: 612, h: 792, margin: 18, gap: 0 };

/**
 * The chosen price tags as a PDF, each at its real size (Admin > Price
 * tags), filled onto letter pages to print at 100% and cut out.
 *   ?items=<productId>:<copies>,<productId>:<copies>
 */
export async function GET(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const items = (new URL(req.url).searchParams.get("items") ?? "")
    .split(",")
    .map((s) => s.split(":"))
    .map(([id, n]) => ({ id, copies: Math.min(50, Math.max(0, Math.round(Number(n) || 0))) }))
    .filter((i) => i.id && i.copies > 0)
    .slice(0, 60);
  if (!items.length) return apiError(400, "Pick at least one tag.");

  try {
    const size = await getTagSize();
    const tw = size.widthIn * 72;
    const th = size.heightIn * 72;
    const cols = Math.max(1, Math.floor((PAGE.w - 2 * PAGE.margin + PAGE.gap) / (tw + PAGE.gap)));
    const rows = Math.max(1, Math.floor((PAGE.h - 2 * PAGE.margin + PAGE.gap) / (th + PAGE.gap)));
    // Centre the grid on the page.
    const left = (PAGE.w - (cols * tw + (cols - 1) * PAGE.gap)) / 2;
    const top = (PAGE.h - (rows * th + (rows - 1) * PAGE.gap)) / 2;

    const pdf = await PDFDocument.create();
    pdf.setTitle("Price tags");
    let page = null;
    let slot = 0;
    for (const item of items) {
      const look = await tagLookFor(item.id);
      if (!look) continue;
      const image = await pdf.embedPng(await renderTagPng(look, size));
      for (let c = 0; c < item.copies; c++) {
        if (!page || slot === cols * rows) {
          page = pdf.addPage([PAGE.w, PAGE.h]);
          slot = 0;
        }
        const x = left + (slot % cols) * (tw + PAGE.gap);
        const y = PAGE.h - top - (Math.floor(slot / cols) + 1) * th - Math.floor(slot / cols) * PAGE.gap;
        page.drawImage(image, { x, y, width: tw, height: th });
        slot++;
      }
    }
    const bytes = await pdf.save();
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="price-tags.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("price-tags:pdf", err);
    return apiError(500, "Couldn't make the PDF.");
  }
}
