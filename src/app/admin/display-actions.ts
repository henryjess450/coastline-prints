"use server";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { logError } from "@/lib/api";
import { saveDisplaySettings } from "@/lib/pos/slides.server";
import type { DisplaySettings } from "@/lib/pos/types";

/** Admin > Display: which slides the customer display shows between sales. The stand picks it up within five minutes. */
export async function saveDisplayAction(settings: DisplaySettings): Promise<ActionState> {
  await requireAdmin();
  try {
    await saveDisplaySettings(settings);
  } catch (err) {
    logError("display:settings", err);
    return { error: "Couldn't save those slides." };
  }
  revalidatePath("/admin/display");
  return { ok: true, message: "Saved. The display picks it up within five minutes." };
}
