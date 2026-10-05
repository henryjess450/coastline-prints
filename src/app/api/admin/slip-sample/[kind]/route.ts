import { apiError, logError } from "@/lib/api";
import { requestIsAdmin } from "@/lib/admin/auth";
import { pngToBitmap } from "@/lib/receipt/bitmap";
import { renderSampleSlipPng } from "@/lib/receipt/code-slip";
import { PNG } from "pngjs";

export const runtime = "nodejs";

/**
 * Example slip with placeholder numbers. Admin only.
 *   /api/admin/slip-sample/gift-card    /api/admin/slip-sample/coupon
 * Add ?printed=1 to see it exactly as the black-and-white printer will print it.
 */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const { kind } = await ctx.params;
  if (kind !== "gift-card" && kind !== "coupon") return apiError(404, "Use gift-card or coupon.");
  try {
    const { png: raw } = await renderSampleSlipPng(kind === "gift-card" ? "gift" : "coupon");
    const png: Buffer = new URL(req.url).searchParams.get("printed") === "1" ? toPrinted(raw) : raw;
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("admin:slip-sample", err);
    return apiError(500, "Couldn't render the sample.");
  }
}

/** Runs the image through the printer conversion (1-bit, dithered grey) and back to PNG. */
function toPrinted(png: Buffer) {
  const bmp = pngToBitmap(png, 150, { dither: true });
  const img = new PNG({ width: bmp.widthBytes * 8, height: bmp.heightDots });
  for (let y = 0; y < bmp.heightDots; y++)
    for (let x = 0; x < img.width; x++) {
      const on = bmp.data[y * bmp.widthBytes + (x >> 3)] & (0x80 >> (x & 7));
      const i = (y * img.width + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = on ? 0 : 255;
      img.data[i + 3] = 255;
    }
  return PNG.sync.write(img);
}
