"use server";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { logError } from "@/lib/api";
import { LAMP_ANIM_IDS, type LampAnim } from "@/lib/lamp/animations";
import { getLampSettings, lampPresence, newLampKey, queueLamp, saveLampSettings } from "@/lib/lamp/server";

/* The order lamp's dashboard controls. Every action checks the admin session first. */

export async function playLampAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const anim = String(form.get("anim") ?? "") as LampAnim;
  if (!LAMP_ANIM_IDS.includes(anim)) return { error: "Pick an animation." };
  await queueLamp([anim], "dash");
  revalidatePath("/admin/lamp");
  return { ok: true, message: lampPresence().online ? "Sent to the lamp." : "Queued. The lamp is offline, so it plays if it's back within 10 minutes." };
}

export async function saveLampSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const n = (k: string) => Number(form.get(k));
  const s = (k: string) => String(form.get(k) ?? "");
  try {
    const current = await getLampSettings();
    await saveLampSettings({
      ...current,
      brightness: Math.round(n("brightness")),
      idle: s("idle"),
      play: { print: s("play.print"), coastline: s("play.coastline"), lightlab: s("play.lightlab"), gift: s("play.gift") },
      bigCents: s("bigDollars") === "" ? 0 : Math.round(n("bigDollars") * 100),
      bigAnim: s("bigAnim"),
      quiet: { on: form.get("quiet.on") === "on", from: n("quiet.from"), to: n("quiet.to") },
    });
  } catch (err) {
    logError("lamp:settings", err);
    return { error: "Some of those settings didn't make sense. Check the numbers and try again." };
  }
  revalidatePath("/admin/lamp");
  return { ok: true, message: "Saved. The lamp picks it up on its next check (within 25 seconds)." };
}

export type LampKeyState = ActionState & { key?: string };

export async function newLampKeyAction(): Promise<LampKeyState> {
  await requireAdmin();
  const key = await newLampKey();
  revalidatePath("/admin/lamp");
  return { ok: true, key };
}
