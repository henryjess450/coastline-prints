"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { pairKiosk, setKioskMode, unpairKiosk } from "@/lib/kiosk/server";

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
