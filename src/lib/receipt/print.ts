import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pngToBitmap } from "./bitmap";
import { renderCodeSlipPng } from "./code-slip";
import { encodeEscPos, encodeStar } from "./escpos";
import { loadReceiptData, renderReceiptPng } from "./render";
import { renderScanStubPng } from "./scan-stub";
import { sendToPrinter } from "./send";
import { bridgeKeyMadeAt, bridgePresence, queueBridgeJob } from "./bridge";
import { getPrintSettings } from "./settings";
import { renderStandSlipForOrder, STAND_SLIP_NAMES, type StandSlip } from "./stand";

/** A home network printer, or a print bridge set up on Admin > Receipts. */
export async function receiptPrinterConfigured() {
  return !!process.env.RECEIPT_PRINTER_HOST || !!(await bridgeKeyMadeAt());
}

/**
 * Where a print goes: the print bridge (the printer plugged into a Pi or
 * laptop away from home, e.g. at the market stand) or the printer on the
 * home network. "auto" picks the bridge while it's online.
 */
export async function printDestination(): Promise<"bridge" | "home"> {
  const { route } = await getPrintSettings();
  if (route !== "auto") return route;
  if (bridgePresence().online || !process.env.RECEIPT_PRINTER_HOST) return "bridge";
  return "home";
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
  const bitmap = pngToBitmap(png, 150, opts);
  const bytes = process.env.RECEIPT_PRINTER_MODE === "escpos" ? encodeEscPos(bitmap) : encodeStar(bitmap);
  if ((await printDestination()) === "bridge") {
    if (!(await bridgeKeyMadeAt())) throw new Error("No printer: set RECEIPT_PRINTER_HOST or set up the print bridge on Admin > Receipts");
    await queueBridgeJob(name, bytes);
    return;
  }
  const host = process.env.RECEIPT_PRINTER_HOST;
  if (!host) throw new Error("RECEIPT_PRINTER_HOST is not set");
  await sendToPrinter(bytes, host, Number(process.env.RECEIPT_PRINTER_PORT ?? 9100));
}

/** A LightLab stand slip for the customer: receipt, gift receipt or order ticket, themed for the market and season. */
export async function printStandSlip(orderId: string, slip: StandSlip, marketId?: string | null) {
  const { png, orderNumber } = await renderStandSlipForOrder(orderId, slip, marketId);
  await printPng(png, `${STAND_SLIP_NAMES[slip]} ${orderNumber}`);
}

/** Sends an already-rendered PNG (previews, test prints). */
export const printImage = (png: Buffer, label: string) => printPng(png, label);

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

/** The "updated to…" stub after a scan at the scan station. */
export async function printScanStub(orderId: string, statusLabel: string) {
  const { png, orderNumber } = await renderScanStubPng(orderId, statusLabel);
  await printPng(png, `${orderNumber}-stub`);
}
