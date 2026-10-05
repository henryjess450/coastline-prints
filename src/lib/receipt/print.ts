import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pngToBitmap } from "./bitmap";
import { encodeEscPos, encodeStar } from "./escpos";
import { loadReceiptData, renderReceiptPng } from "./render";
import { sendToPrinter } from "./send";

export function receiptPrinterConfigured() {
  return !!process.env.RECEIPT_PRINTER_HOST;
}

/**
 * Renders and prints an order receipt on the shop's network printer.
 * Outside production it saves the image to storage/receipt-previews/
 * instead (set PRINT_IN_DEV="true" to really print while developing).
 */
export async function printOrderReceipt(orderId: string, opts: { test?: boolean } = {}) {
  const data = await loadReceiptData(orderId);
  if (!data) throw new Error(`Order ${orderId} not found`);
  const png = await renderReceiptPng(data, opts);

  if (process.env.NODE_ENV !== "production" && process.env.PRINT_IN_DEV !== "true") {
    const dir = path.resolve(process.env.STORAGE_DIR ?? "./storage", "receipt-previews");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${data.orderNumber}-${Date.now()}.png`);
    await writeFile(file, png);
    console.info(`[receipt:preview] ${data.orderNumber} → ${file}`);
    return;
  }

  const host = process.env.RECEIPT_PRINTER_HOST;
  if (!host) throw new Error("RECEIPT_PRINTER_HOST is not set");
  const bitmap = pngToBitmap(png);
  const bytes = process.env.RECEIPT_PRINTER_MODE === "escpos" ? encodeEscPos(bitmap) : encodeStar(bitmap);
  await sendToPrinter(bytes, host, Number(process.env.RECEIPT_PRINTER_PORT ?? 9100));
}
