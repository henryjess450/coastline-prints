import { apiError, logError } from "@/lib/api";
import { requestIsAdmin } from "@/lib/admin/auth";
import { cleanColors, getTagSize, renderTagPng, tagLookFor } from "@/lib/receipt/price-tag";

export const runtime = "nodejs";

/**
 * A product's price tag as a picture, for the admin. Unsaved edits can be
 * tried with ?colors=#aa0000,#0000aa&price=#333333&image=<storage key>.
 */
export async function GET(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const q = new URL(req.url).searchParams;
  const look = await tagLookFor(q.get("product") ?? "");
  if (!look) return apiError(404, "No such product.");
  if (q.has("colors")) look.colors = cleanColors((q.get("colors") ?? "").split(","));
  if (q.has("price")) look.priceColor = /^#[0-9a-f]{6}$/i.test(q.get("price") ?? "") ? q.get("price") : null;
  if (q.get("image")?.startsWith("shop/")) look.image = q.get("image");
  try {
    const png = await renderTagPng(look, await getTagSize(), 0.45);
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("price-tags:preview", err);
    return apiError(500, "Couldn't draw the tag.");
  }
}
