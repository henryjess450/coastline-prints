/**
 * Prints a SAMPLE gift card and coupon slip (placeholder numbers, nothing is
 * saved, they can't be redeemed) to check the printer and the design.
 *   npx tsx --conditions=react-server scripts/print-slip-samples.mts [printer-ip]
 * Docker: docker compose exec app npx tsx --conditions=react-server scripts/print-slip-samples.mts
 */
import "dotenv/config";

const host = process.argv[2] ?? process.env.RECEIPT_PRINTER_HOST;
if (!host) throw new Error("Pass the printer IP or set RECEIPT_PRINTER_HOST in .env");

const { renderSampleSlipPng } = await import("../src/lib/receipt/code-slip");
const { pngToBitmap } = await import("../src/lib/receipt/bitmap");
const { encodeEscPos, encodeStar } = await import("../src/lib/receipt/escpos");
const { sendToPrinter } = await import("../src/lib/receipt/send");

const port = Number(process.env.RECEIPT_PRINTER_PORT ?? 9100);
for (const kind of ["gift", "coupon"] as const) {
  const { png } = await renderSampleSlipPng(kind);
  const bitmap = pngToBitmap(png, 150, { dither: true }); // grey heading as a dot pattern
  const bytes = process.env.RECEIPT_PRINTER_MODE === "escpos" ? encodeEscPos(bitmap) : encodeStar(bitmap);
  console.log(`Sending sample ${kind === "gift" ? "gift card" : "coupon"} (${bitmap.heightDots} dot rows) to ${host}:${port} ...`);
  await sendToPrinter(bytes, host, port);
}
console.log("Sent.");
