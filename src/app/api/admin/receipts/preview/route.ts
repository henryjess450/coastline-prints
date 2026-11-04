import { PNG } from "pngjs";
import { apiError, logError } from "@/lib/api";
import { requestIsAdmin } from "@/lib/admin/auth";
import { pngToBitmap } from "@/lib/receipt/bitmap";
import { renderStandSlipPng, sampleSlipData, STAND_SLIPS, standTheme, type StandSlip } from "@/lib/receipt/stand";
import { marketSchema, SEASON_MESSAGES } from "@/lib/receipt/themes";

export const runtime = "nodejs";

/**
 * A LightLab stand slip for a made-up order, exactly as the printer prints it
 * (1-bit black and white). Admin only.
 *   ?slip=receipt|gift|claim&market=<id>&season=<auto|site|id>
 * Unsaved market edits can be previewed with name, place, message and art.
 */
export async function GET(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const q = new URL(req.url).searchParams;
  const slip = (STAND_SLIPS.includes(q.get("slip") as StandSlip) ? q.get("slip") : "receipt") as StandSlip;
  try {
    const theme = await standTheme(q.get("market"), q.get("season"));
    if (q.get("name")) {
      const draft = marketSchema.safeParse({ id: "preview", name: q.get("name"), place: q.get("place") ?? "", message: q.get("message") ?? "", art: q.get("art") ?? "none" });
      if (draft.success) theme.market = draft.data;
    }
    if (q.has("seasonMessage")) theme.seasonMessage = q.get("seasonMessage") || SEASON_MESSAGES[theme.season];
    const bmp = pngToBitmap(await renderStandSlipPng(slip, sampleSlipData(slip), theme));
    const img = new PNG({ width: bmp.widthBytes * 8, height: bmp.heightDots });
    for (let y = 0; y < bmp.heightDots; y++)
      for (let x = 0; x < img.width; x++) {
        const on = bmp.data[y * bmp.widthBytes + (x >> 3)] & (0x80 >> (x & 7));
        const i = (y * img.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = on ? 0 : 255;
        img.data[i + 3] = 255;
      }
    return new Response(new Uint8Array(PNG.sync.write(img)), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Season": theme.season } });
  } catch (err) {
    logError("admin:receipt-preview", err);
    return apiError(500, "Couldn't render the preview.");
  }
}
