/**
 * Prints a SAMPLE gift card and coupon slip (placeholder numbers, nothing is
 * saved, they can't be redeemed) to check the printer and the design.
 *   npx tsx --conditions=react-server scripts/print-slip-samples.mts [printer-ip]
 * Docker: docker compose exec app npx tsx --conditions=react-server scripts/print-slip-samples.mts
 * Add --preview <folder> to save them as images (exactly as printed) instead of printing.
 */
import "dotenv/config";

const args = process.argv.slice(2);
const previewAt = args.indexOf("--preview");
const previewDir = previewAt >= 0 ? args[previewAt + 1] : null;
const host = args.find((a, i) => !a.startsWith("--") && (previewAt < 0 || i !== previewAt + 1)) ?? process.env.RECEIPT_PRINTER_HOST;
if (!host && !previewDir) throw new Error("Pass the printer IP or set RECEIPT_PRINTER_HOST in .env");

const { renderSampleSlipPng } = await import("../src/lib/receipt/code-slip");
const { pngToBitmap } = await import("../src/lib/receipt/bitmap");
const { encodeEscPos, encodeStar } = await import("../src/lib/receipt/escpos");
const { sendToPrinter } = await import("../src/lib/receipt/send");

const port = Number(process.env.RECEIPT_PRINTER_PORT ?? 9100);
for (const kind of ["gift", "coupon"] as const) {
  const { png } = await renderSampleSlipPng(kind);
  const bitmap = pngToBitmap(png, 150, { dither: true }); // grey heading as a dot pattern
  if (previewDir) {
    const { PNG } = await import("pngjs");
    const { writeFileSync } = await import("node:fs");
    const img = new PNG({ width: bitmap.widthBytes * 8, height: bitmap.heightDots });
    for (let y = 0; y < bitmap.heightDots; y++)
      for (let x = 0; x < img.width; x++) {
        const on = bitmap.data[y * bitmap.widthBytes + (x >> 3)] & (0x80 >> (x & 7));
        const i = (y * img.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = on ? 0 : 255;
        img.data[i + 3] = 255;
      }
    const file = `${previewDir}/sample-${kind}.png`;
    writeFileSync(file, PNG.sync.write(img));
    console.log(`Saved ${file}`);
    continue;
  }
  const bytes = process.env.RECEIPT_PRINTER_MODE === "escpos" ? encodeEscPos(bitmap) : encodeStar(bitmap);
  console.log(`Sending sample ${kind === "gift" ? "gift card" : "coupon"} (${bitmap.heightDots} dot rows) to ${host}:${port} ...`);
  await sendToPrinter(bytes, host!, port);
}
console.log(previewDir ? "Done." : "Sent.");
