/**
 * Prints a TEST receipt for the most recent order on the receipt printer.
 *   npx tsx --conditions=react-server scripts/print-test.mts [printer-ip]
 * Docker: docker compose exec app npx tsx --conditions=react-server scripts/print-test.mts
 */
import "dotenv/config";

const host = process.argv[2] ?? process.env.RECEIPT_PRINTER_HOST;
if (!host) throw new Error("Pass the printer IP or set RECEIPT_PRINTER_HOST in .env");

const { db } = await import("../src/lib/db");
const { loadReceiptData, renderReceiptPng } = await import("../src/lib/receipt/render");
const { pngToBitmap } = await import("../src/lib/receipt/bitmap");
const { encodeEscPos, encodeStar } = await import("../src/lib/receipt/escpos");
const { sendToPrinter } = await import("../src/lib/receipt/send");

const order = await db.order.findFirst({ orderBy: { createdAt: "desc" } });
if (!order) throw new Error("No orders yet.");
const png = await renderReceiptPng((await loadReceiptData(order.id))!, { test: true });
const bitmap = pngToBitmap(png);
const mode = process.env.RECEIPT_PRINTER_MODE === "escpos" ? "escpos" : "star";
const bytes = mode === "escpos" ? encodeEscPos(bitmap) : encodeStar(bitmap);
console.log(`Sending ${bytes.length} bytes (${bitmap.heightDots} dot rows, ${mode} mode) to ${host}:9100 ...`);
await sendToPrinter(bytes, host, Number(process.env.RECEIPT_PRINTER_PORT ?? 9100));
console.log("Sent.");
await db.$disconnect();
