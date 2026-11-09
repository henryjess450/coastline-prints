"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { pairKiosk, setKioskMode, unpairKiosk } from "@/lib/kiosk/server";
import { saveCardFee } from "@/lib/pos/card-fee.server";

export async function pairKioskAction(code: string, name: string): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  const k = await pairKiosk(code, name.trim().slice(0, 40));
  if (!k) return { error: "No tablet is showing that code. Check it, or reload /kiosk on the tablet." };
  revalidatePath("/lightlab/admin/kiosk");
  return { ok: true };
}

export async function unpairKioskAction(id: string): Promise<{ ok?: boolean }> {
  await requireAdmin();
  await unpairKiosk(id).catch(() => undefined);
  revalidatePath("/lightlab/admin/kiosk");
  return { ok: true };
}

export async function setKioskModeAction(id: string, mode: "shop" | "order"): Promise<{ ok?: boolean }> {
  await requireAdmin();
  await setKioskMode(id, mode === "order" ? "order" : "shop");
  revalidatePath("/lightlab/admin/kiosk");
  return { ok: true };
}

/** The card processing fee on Square links (kiosk and the register's Scan to pay). */
export async function saveCardFeeAction(input: { on: boolean; percent: number; fixedCents: number }): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  try {
    await saveCardFee(input);
  } catch {
    return { error: "Check the percent (0 to 10) and the cents (0 to 500)." };
  }
  revalidatePath("/lightlab/admin/kiosk");
  revalidatePath("/admin/pos");
  return { ok: true };
}
