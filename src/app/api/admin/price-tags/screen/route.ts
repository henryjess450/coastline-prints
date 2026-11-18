import { apiError, logError } from "@/lib/api";
import { requestIsAdmin } from "@/lib/admin/auth";
import { tagLookFor } from "@/lib/receipt/price-tag";
import { oledPreviewPng, renderOledTag } from "@/lib/receipt/price-tag-oled";

export const runtime = "nodejs";

/**
 * A product's tag for the 128x128 screen (firmware/pricetag): ?product=<id>
 * gives a PNG preview, and &format=raw the 8192 bytes the dashboard sends to
 * the board over USB.
 */
export async function GET(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const q = new URL(req.url).searchParams;
  const look = await tagLookFor(q.get("product") ?? "");
  if (!look) return apiError(404, "No such product.");
  try {
    const packed = await renderOledTag(look);
    if (q.get("format") === "raw") {
      return new Response(new Uint8Array(packed), { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" } });
    }
    const png = await oledPreviewPng(packed);
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("price-tags:screen", err);
    return apiError(500, "Couldn't draw the screen tag.");
  }
}
