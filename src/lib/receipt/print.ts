import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pngToBitmap } from "./bitmap";
import { renderCodeSlipPng } from "./code-slip";
import { encodeEscPos, encodeStar } from "./escpos";
import { loadReceiptData, renderReceiptPng } from "./render";
import { sendToPrinter } from "./send";

export function receiptPrinterConfigured() {
  return !!process.env.RECEIPT_PRINTER_HOST;
}

/**
 * Sends a rendered image to the shop's network printer. Outside production
 * it saves the image to storage/receipt-previews/ instead (set
 * PRINT_IN_DEV="true" to really print while developing).
 */
async function printPng(png: Buffer, name: string, opts: { dither?: boolean } = {}) {
  if (process.env.NODE_ENV !== "production" && process.env.PRINT_IN_DEV !== "true") {
    const dir = path.resolve(process.env.STORAGE_DIR ?? "./storage", "receipt-previews");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${name}-${Date.now()}.png`);
    await writeFile(file, png);
    console.info(`[receipt:preview] ${name} → ${file}`);
    return;
  }
  const host = process.env.RECEIPT_PRINTER_HOST;
  if (!host) throw new Error("RECEIPT_PRINTER_HOST is not set");
  const bitmap = pngToBitmap(png, 150, opts);
  const bytes = process.env.RECEIPT_PRINTER_MODE === "escpos" ? encodeEscPos(bitmap) : encodeStar(bitmap);
  await sendToPrinter(bytes, host, Number(process.env.RECEIPT_PRINTER_PORT ?? 9100));
}

/** Order ticket for the shop. */
export async function printOrderReceipt(orderId: string, opts: { test?: boolean } = {}) {
  const data = await loadReceiptData(orderId);
  if (!data) throw new Error(`Order ${orderId} not found`);
  await printPng(await renderReceiptPng(data, opts), data.orderNumber);
}

/** Printed coupon or gift card slip to hand to a customer. */
export async function printCodeSlip(codeId: string) {
  const { png, code } = await renderCodeSlipPng(codeId);
  await printPng(png, code, { dither: true }); // grey "Gift Card" / "Coupon" heading
}
