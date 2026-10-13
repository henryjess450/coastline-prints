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
  /** No sale animations between these hours, shop time. Dashboard plays still work. */
  quiet: z.object({ on: z.boolean().default(false), from: hour.default(22), to: hour.default(8) }).default({ on: false, from: 22, to: 8 }),
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

export async function saveLampSettings(input: unknown) {
  const value = JSON.stringify(lampSettingsSchema.parse(input));
  await db.setting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });
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

const g = globalThis as unknown as { __lamp?: { presence: LampPresence | null; bus: EventTarget } };
const lamp = (g.__lamp ??= { presence: null, bus: new EventTarget() });

export function lampSeen(p: Omit<LampPresence, "seenAt" | "waiting">, waitingDelta = 0) {
  lamp.presence = { ...p, seenAt: Date.now(), waiting: Math.max(0, (lamp.presence?.waiting ?? 0) + waitingDelta) };
}

/** Online while a request is open, or if one ended in the last minute. */
export function lampPresence() {
  const p = lamp.presence;
  const ms = p ? Date.now() - p.seenAt : null;
  return { ...p, online: !!p && (p.waiting > 0 || ms! < 60_000), agoMin: ms == null ? null : Math.round(ms / 60_000) };
}

/** Resolves after `ms`, or sooner if something is queued for the lamp. */
export function waitForLamp(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      lamp.bus.removeEventListener("queued", done);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    lamp.bus.addEventListener("queued", done);
    signal.addEventListener("abort", done);
  });
}

// ── Queueing ────────────────────────────────────────────────────────────

export async function queueLamp(anims: string[], reason: string) {
  await db.lampEvent.createMany({ data: anims.map((a) => ({ anim: a, reason })) });
  lamp.bus.dispatchEvent(new Event("queued"));
}

function inQuietHours(s: LampSettings, now = new Date()) {
  if (!s.quiet.on || s.quiet.from === s.quiet.to) return false;
  const h = Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hourCycle: "h23", timeZone: pickup.timeZone }).format(now));
  return s.quiet.from < s.quiet.to ? h >= s.quiet.from && h < s.quiet.to : h >= s.quiet.from || h < s.quiet.to;
}

/** A sale was paid: light the lamp. Never throws (a lamp problem must not break checkout). */
export async function lampForSale(kind: SaleKind, cents: number) {
  try {
    const s = await getLampSettings();
    if (inQuietHours(s)) return;
    const big = s.bigCents > 0 && cents >= s.bigCents;
    await queueLamp(big ? [s.play[kind], s.bigAnim] : [s.play[kind]], kind);
  } catch (err) {
    logError("lamp", err);
  }
}
