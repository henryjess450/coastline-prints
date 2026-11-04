"use server";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { logError } from "@/lib/api";
import { db } from "@/lib/db";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { bridgePresence, cancelJob, newBridgeKey, retryJob } from "@/lib/receipt/bridge";
import { printDestination, printImage } from "@/lib/receipt/print";
import { getPrintSettings, savePrintSettings } from "@/lib/receipt/settings";
import { renderStandSlipPng, sampleSlipData, STAND_SLIP_NAMES, STAND_SLIPS, standTheme, type StandSlip } from "@/lib/receipt/stand";
import type { PrintSettings } from "@/lib/receipt/themes";

/* Admin > Receipts: the print bridge, where tickets go, and the stand's receipt themes. */

const PATH = "/admin/receipts";

export async function saveReceiptSettingsAction(settings: PrintSettings): Promise<ActionState> {
  await requireAdmin();
  try {
    await savePrintSettings(settings);
  } catch (err) {
    logError("receipts:settings", err);
    return { error: err instanceof Error && err.message.includes("same id") ? err.message : "Some of that didn't save. Check every market has a name." };
  }
  revalidatePath(PATH);
  revalidatePath("/admin/pos");
  return { ok: true, message: "Saved." };
}

export type BridgeKeyState = ActionState & { key?: string };

export async function newBridgeKeyAction(): Promise<BridgeKeyState> {
  await requireAdmin();
  const key = await newBridgeKey();
  revalidatePath(PATH);
  return { ok: true, key };
}

/** Prints a sample slip (made-up order) with the chosen theme. */
export async function testPrintAction(slip: string, marketId: string | null, season: string | null): Promise<ActionState> {
  await requireAdmin();
  if (!STAND_SLIPS.includes(slip as StandSlip)) return { error: "Pick a kind of slip." };
  try {
    const png = await renderStandSlipPng(slip as StandSlip, sampleSlipData(slip as StandSlip), await standTheme(marketId, season));
    const where = await printDestination();
    await printImage(png, `Test ${STAND_SLIP_NAMES[slip as StandSlip].toLowerCase()}`);
    revalidatePath(PATH);
    if (process.env.NODE_ENV !== "production" && process.env.PRINT_IN_DEV !== "true") return { ok: true, message: "Saved to storage/receipt-previews (printing is off while developing)." };
    if (where === "bridge") return { ok: true, message: bridgePresence().online ? "Sent to the print bridge." : "Queued. The bridge is offline, so it prints when it's back (within 2 hours)." };
    return { ok: true, message: "Sent to the home printer." };
  } catch (err) {
    logError("receipts:test", err);
    return { error: err instanceof Error ? err.message : "That didn't print." };
  }
}

export async function retryPrintJobAction(id: string): Promise<ActionState> {
  await requireAdmin();
  const again = await retryJob(id);
  revalidatePath(PATH);
  return again ? { ok: true, message: "Back in the queue." } : { error: "That print isn't there any more." };
}

export async function cancelPrintJobAction(id: string): Promise<ActionState> {
  await requireAdmin();
  await cancelJob(id);
  revalidatePath(PATH);
  return { ok: true };
}

/** From an order's page: print one of the stand slips for it. */
export async function printStandSlipAction(form: FormData) {
  await requireAdmin();
  const orderId = String(form.get("orderId") ?? "");
  const slip = String(form.get("slip") ?? "");
  if (!orderId || !STAND_SLIPS.includes(slip as StandSlip)) return;
  const settings = await getPrintSettings();
  const marketId = settings.markets.some((m) => m.id === form.get("marketId")) ? String(form.get("marketId")) : null;
  await db.outboxJob.create({
    data: { kind: "print", template: "stand-slip", payload: JSON.stringify({ orderId, slip, marketId }), dedupeKey: `${orderId}:stand-slip:${slip}:${Date.now()}` },
  });
  sendNotificationsSoon("admin-print");
}
