"use server";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { logError } from "@/lib/api";
import { LAMP_ANIMS, LAMP_ANIM_IDS, type LampAnim } from "@/lib/lamp/animations";
import { getLampSettings, lampForSale, lampPresence, newLampKey, queueLamp, saveLampSettings, setLampIdentify, type SaleKind } from "@/lib/lamp/server";

/* The order lamp's dashboard controls. Every action checks the admin session first. */

export async function playLampAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const anim = String(form.get("anim") ?? "") as LampAnim;
  if (!LAMP_ANIM_IDS.includes(anim)) return { error: "Pick an animation." };
  // Payment counts a sale: the dollars typed on its card ($1 to $48).
  const value = anim === "payment" ? Math.min(48, Math.max(1, Math.round(Number(form.get("dollars")) || 1))) : undefined;
  await queueLamp([{ anim, value }], "dash");
  revalidatePath("/admin/lamp");
  return { ok: true, message: lampPresence().online ? "Sent to the lamp." : "Queued. The lamp is offline, so it plays if it's back within 10 minutes." };
}

export async function saveLampSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const n = (k: string) => Number(form.get(k));
  const s = (k: string) => String(form.get(k) ?? "");
  if (form.get("quiet.on") === "on" && form.get("quiet.from") === form.get("quiet.to")) return { error: "Quiet hours need a different start and end time." };
  try {
    const current = await getLampSettings();
    await saveLampSettings({
      ...current,
      brightness: Math.round(n("brightness")),
      idle: s("idle"),
      play: { print: s("play.print"), coastline: s("play.coastline"), lightlab: s("play.lightlab"), gift: s("play.gift") },
      bigCents: s("bigDollars") === "" ? 0 : Math.round(n("bigDollars") * 100),
      bigAnim: s("bigAnim"),
      count: form.get("count") === "on",
      quiet: { on: form.get("quiet.on") === "on", from: n("quiet.from"), to: n("quiet.to") },
    });
  } catch (err) {
    logError("lamp:settings", err);
    return { error: "Some of those settings didn't make sense. Check the numbers and try again." };
  }
  revalidatePath("/admin/lamp");
  return { ok: true, message: lampPresence().online ? "Saved. The lamp has it now." : "Saved. The lamp gets it when it's back online." };
}

const SALE_KINDS: SaleKind[] = ["print", "coastline", "lightlab", "gift"];

/** Runs a pretend sale through the same rules as a real one: quiet hours, big orders, Payment. */
export async function testSaleAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const kind = String(form.get("kind")) as SaleKind;
  const dollars = Math.round(Number(form.get("dollars")));
  if (!SALE_KINDS.includes(kind) || !(dollars >= 1 && dollars <= 10_000)) return { error: "Pick a kind of sale and an amount from $1." };
  const played = await lampForSale(kind, dollars * 100, "test");
  if (played === "quiet") return { ok: true, message: "It's quiet hours, so nothing played. A real order now would stay dark too." };
  if (!played) return { error: "That didn't work. Please try again." };
  revalidatePath("/admin/lamp");
  const names = played.map((a) => LAMP_ANIMS[a as LampAnim]?.name ?? a);
  return { ok: true, message: `Playing ${names.join(", then ")}.${lampPresence().online ? "" : " (The lamp is offline right now.)"}` };
}

/** "Set the bottom", step 1: the lamp shows one colour per LED (or stops showing them). */
export async function identifyLampAction(on: boolean): Promise<ActionState> {
  await requireAdmin();
  setLampIdentify(on);
  if (on && !lampPresence().online) return { error: "The lamp is offline. Plug it in and wait for its seafoam lap, then try again." };
  return { ok: true };
}

/**
 * "Set the bottom", step 2: which colour is at the bottom, and which is next
 * to it going clockwise. Colours are physical LED numbers (IDENTIFY_COLORS).
 */
export async function setBottomAction(bottom: number, next: number): Promise<ActionState> {
  await requireAdmin();
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n < 12;
  if (!ok(bottom) || !ok(next)) return { error: "Pick two colours." };
  const reverse = next === (bottom + 11) % 12;
  if (!reverse && next !== (bottom + 1) % 12) return { error: "Those two colours aren't next to each other on the ring. Look again and pick the bottom one first." };
  await saveLampSettings({ ...(await getLampSettings()), offset: bottom, reverse });
  setLampIdentify(false);
  // The tide rises from the new bottom, so you can see it took.
  await queueLamp([{ anim: "tide" }], "dash");
  revalidatePath("/admin/lamp");
  return { ok: true, message: "Bottom set. Watch the tide rise from the bottom of the ring." };
}

export type LampKeyState = ActionState & { key?: string };

export async function newLampKeyAction(): Promise<LampKeyState> {
  await requireAdmin();
  const key = await newLampKey();
  revalidatePath("/admin/lamp");
  return { ok: true, key };
}
