import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { pickup } from "@config/pickup";
import { logError } from "@/lib/api";
import { db } from "@/lib/db";
import { LAMP_ANIM_IDS } from "./animations";

/*
 * The order lamp: an ESP32-C3 with an LED ring (firmware/lamp). It keeps a
 * request open to /api/lamp; queueLamp() adds an animation and wakes it.
 */

const anim = z.enum(LAMP_ANIM_IDS as [string, ...string[]]);
const hour = z.number().int().min(0).max(23);

export const lampSettingsSchema = z.object({
  brightness: z.number().int().min(5).max(100).default(40),
  idle: z.enum(["off", "calm"]).default("off"),
  /** Which animation plays for each kind of sale. */
  play: z
    .object({ print: anim.default("tide"), coastline: anim.default("ripple"), lightlab: anim.default("lighthouse"), gift: anim.default("sunset") })
    .default({ print: "tide", coastline: "ripple", lightlab: "lighthouse", gift: "sunset" }),
  /** A sale this big (cents, gift cards included) also plays `bigAnim` afterwards. 0 = never. */
  bigCents: z.number().int().min(0).max(10_000_00).default(100_00),
  bigAnim: anim.default("treasure"),
  /** Then Payment counts what the sale made, one LED per dollar. */
  count: z.boolean().default(true),
  /** No sale animations between these hours, shop time. Dashboard plays still work. */
  quiet: z.object({ on: z.boolean().default(false), from: hour.default(22), to: hour.default(8) }).default({ on: false, from: 22, to: 8 }),
  /** Which physical LED is the bottom of the ring, and whether the next one clockwise is the one before it. Set with "Set the bottom". */
  offset: z.number().int().min(0).max(11).default(0),
  reverse: z.boolean().default(false),
});
export type LampSettings = z.infer<typeof lampSettingsSchema>;
export type SaleKind = keyof LampSettings["play"];

const SETTINGS_KEY = "lamp";
const KEY_KEY = "lamp-key";

export async function getLampSettings(): Promise<LampSettings> {
  const row = await db.setting.findUnique({ where: { key: SETTINGS_KEY } });
  const parsed = lampSettingsSchema.safeParse(row ? JSON.parse(row.value) : {});
  return parsed.success ? parsed.data : lampSettingsSchema.parse({});
}

/** Saves and tells a waiting lamp straight away, so brightness and the idle glow change within a second. */
export async function saveLampSettings(input: unknown) {
  const value = JSON.stringify(lampSettingsSchema.parse(input));
  await db.setting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });
  lamp.settingsRev++;
  lamp.bus.dispatchEvent(new Event("wake"));
}

// ── The lamp key (the lamp sends it; we only keep its hash) ─────────────

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Makes a new lamp key, replacing the old one. Returns it: it's shown once. */
export async function newLampKey() {
  const key = `lamp_${randomBytes(24).toString("base64url")}`;
  const value = JSON.stringify({ hash: sha(key), madeAt: new Date().toISOString() });
  await db.setting.upsert({ where: { key: KEY_KEY }, create: { key: KEY_KEY, value }, update: { value } });
  return key;
}

export async function lampKeyMadeAt() {
  const row = await db.setting.findUnique({ where: { key: KEY_KEY } });
  return row ? new Date((JSON.parse(row.value) as { madeAt: string }).madeAt) : null;
}

export async function lampKeyOk(header: string | null) {
  const given = header?.match(/^Bearer (lamp_[\w-]{20,64})$/)?.[1];
  if (!given) return false;
  const row = await db.setting.findUnique({ where: { key: KEY_KEY } });
  if (!row) return false;
  const want = Buffer.from((JSON.parse(row.value) as { hash: string }).hash, "hex");
  const got = Buffer.from(sha(given), "hex");
  return want.length === got.length && timingSafeEqual(want, got);
}

// ── Presence and wake-ups (in memory: the site is one process) ──────────

export type LampPresence = { seenAt: number; waiting: number; ip: string; rssi: number | null; version: string | null };

const g = globalThis as unknown as { __lamp?: { presence: LampPresence | null; bus: EventTarget; settingsRev: number; identifyUntil: number } };
const lamp = (g.__lamp ??= { presence: null, bus: new EventTarget(), settingsRev: 0, identifyUntil: 0 });
lamp.settingsRev ??= 0;
lamp.identifyUntil ??= 0;

/** How long the lamp shows its colours for "Set the bottom" before going back to normal. */
const IDENTIFY_MS = 3 * 60_000;

/** Starts (or stops) "Set the bottom": the lamp shows one colour per LED. Tells a waiting lamp at once. */
export function setLampIdentify(on: boolean) {
  lamp.identifyUntil = on ? Date.now() + IDENTIFY_MS : 0;
  lamp.settingsRev++;
  lamp.bus.dispatchEvent(new Event("wake"));
}

/** When the colours go away by themselves (ms since epoch), or 0 if they aren't showing. */
export const lampIdentifyUntil = () => (lamp.identifyUntil > Date.now() ? lamp.identifyUntil : 0);

/** Goes up on every settings save; a waiting request answers early when it changes. */
export const lampSettingsRev = () => lamp.settingsRev;

export function lampSeen(p: Omit<LampPresence, "seenAt" | "waiting">, waitingDelta = 0) {
  lamp.presence = { ...p, seenAt: Date.now(), waiting: Math.max(0, (lamp.presence?.waiting ?? 0) + waitingDelta) };
}

/** Online while a request is open, or if one ended in the last minute. */
export function lampPresence() {
  const p = lamp.presence;
  const ms = p ? Date.now() - p.seenAt : null;
  return { ...p, online: !!p && (p.waiting > 0 || ms! < 60_000), agoMin: ms == null ? null : Math.round(ms / 60_000) };
}

/** Resolves after `ms`, or sooner if something is queued or the settings change. */
export function waitForLamp(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      lamp.bus.removeEventListener("wake", done);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    lamp.bus.addEventListener("wake", done);
    signal.addEventListener("abort", done);
  });
}

// ── Queueing ────────────────────────────────────────────────────────────

/** `value` is the sale in whole dollars (Payment counts it). */
export async function queueLamp(anims: { anim: string; value?: number }[], reason: string) {
  await db.lampEvent.createMany({ data: anims.map((a) => ({ anim: a.anim, value: a.value ?? null, reason })) });
  lamp.bus.dispatchEvent(new Event("wake"));
}

/** Quiet hours: sales don't light the lamp and the idle glow goes dark. */
export function inQuietHours(s: LampSettings, now = new Date()) {
  if (!s.quiet.on || s.quiet.from === s.quiet.to) return false;
  const h = Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hourCycle: "h23", timeZone: pickup.timeZone }).format(now));
  return s.quiet.from < s.quiet.to ? h >= s.quiet.from && h < s.quiet.to : h >= s.quiet.from || h < s.quiet.to;
}

/** The idle look to send the lamp right now. */
export const lampIdle = (s: LampSettings, now = new Date()) => (inQuietHours(s, now) ? "off" : s.idle);

/**
 * A sale was paid: light the lamp. `cents` is what it made (gift cards
 * included, shipping left out). Returns what was queued ("quiet" in quiet
 * hours). Never throws: a lamp problem must not break checkout.
 */
export async function lampForSale(kind: SaleKind, cents: number, reason: string = kind): Promise<string[] | "quiet" | null> {
  try {
    const s = await getLampSettings();
    if (inQuietHours(s)) return "quiet";
    const value = Math.max(1, Math.round(cents / 100));
    const anims = [s.play[kind], s.bigCents > 0 && cents >= s.bigCents && s.bigAnim, s.count && "payment"].filter((a): a is string => !!a);
    await queueLamp(anims.map((anim) => ({ anim, value })), reason);
    return anims;
  } catch (err) {
    logError("lamp", err);
    return null;
  }
}
