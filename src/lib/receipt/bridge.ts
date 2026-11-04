import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

/*
 * The print bridge (bridge/print-bridge.mjs): a Raspberry Pi or laptop
 * plugged into the receipt printer by ethernet, online through a phone
 * hotspot. The printer itself never needs Wi-Fi or internet. The bridge
 * keeps a request open to /api/print-bridge; queueBridgeJob() wakes it and
 * it sends the bytes to the printer, then says how it went.
 */

/** Jobs older than this are left alone: a receipt from hours ago is no use. */
export const JOB_TTL_MS = 2 * 60 * 60_000;
/** A job the bridge took but never confirmed is marked failed after this. */
const CONFIRM_MS = 2 * 60_000;

// ── The bridge key (the bridge sends it; we only keep its hash) ─────────

const KEY_KEY = "print-bridge-key";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Makes a new bridge key, replacing the old one. Returns it: it's shown once. */
export async function newBridgeKey() {
  const key = `pb_${randomBytes(24).toString("base64url")}`;
  const value = JSON.stringify({ hash: sha(key), madeAt: new Date().toISOString() });
  await db.setting.upsert({ where: { key: KEY_KEY }, create: { key: KEY_KEY, value }, update: { value } });
  return key;
}

export async function bridgeKeyMadeAt() {
  const row = await db.setting.findUnique({ where: { key: KEY_KEY } });
  return row ? new Date((JSON.parse(row.value) as { madeAt: string }).madeAt) : null;
}

export async function bridgeKeyOk(header: string | null) {
  const given = header?.match(/^Bearer (pb_[\w-]{20,64})$/)?.[1];
  if (!given) return false;
  const row = await db.setting.findUnique({ where: { key: KEY_KEY } });
  if (!row) return false;
  const want = Buffer.from((JSON.parse(row.value) as { hash: string }).hash, "hex");
  const got = Buffer.from(sha(given), "hex");
  return want.length === got.length && timingSafeEqual(want, got);
}

// ── Presence and wake-ups (in memory: the site is one process) ──────────

/** What the bridge last told us: where it is and whether it can reach the printer. */
export type BridgeReport = { ip: string; version: string | null; printer: "ok" | "missing" | null; printerHost: string | null };
type Presence = BridgeReport & { seenAt: number; waiting: number };

const g = globalThis as unknown as { __printBridge?: { presence: Presence | null; bus: EventTarget } };
const bridge = (g.__printBridge ??= { presence: null, bus: new EventTarget() });

export function bridgeSeen(r: BridgeReport, waitingDelta = 0) {
  bridge.presence = { ...r, seenAt: Date.now(), waiting: Math.max(0, (bridge.presence?.waiting ?? 0) + waitingDelta) };
}

/** Online while a request is open, or if one ended in the last minute. */
export function bridgePresence() {
  const p = bridge.presence;
  const ms = p ? Date.now() - p.seenAt : null;
  return { ...p, online: !!p && (p.waiting > 0 || ms! < 60_000), agoMin: ms == null ? null : Math.round(ms / 60_000) };
}

/** Resolves after `ms`, or sooner when a job is queued or finished. */
export function waitForBridge(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      bridge.bus.removeEventListener("wake", done);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    bridge.bus.addEventListener("wake", done);
    signal?.addEventListener("abort", done);
  });
}

const wake = () => bridge.bus.dispatchEvent(new Event("wake"));

// ── Jobs ────────────────────────────────────────────────────────────────

/**
 * Queues bytes for the bridge and waits up to `waitMs` for it to print them.
 * Throws if the printer reported a problem (so the outbox tries again). If
 * the bridge is offline the job stays queued and prints when it's back
 * (within JOB_TTL_MS).
 */
export async function queueBridgeJob(label: string, bytes: Buffer, waitMs = 20_000) {
  const job = await db.printJob.create({ data: { label, bytes: new Uint8Array(bytes) } });
  wake();
  const until = Date.now() + waitMs;
  while (Date.now() < until) {
    await waitForBridge(Math.min(5_000, until - Date.now()));
    const now = await db.printJob.findUnique({ where: { id: job.id }, select: { status: true, error: true } });
    if (now?.status === "PRINTED") return { id: job.id, printed: true };
    if (now?.status === "FAILED") throw new Error(`Print bridge: ${now.error ?? "the printer didn't print it"}`);
  }
  return { id: job.id, printed: false };
}

/** The next job for the bridge, marked as taken. Jobs it took and never confirmed are failed first. */
export async function takeNextJob() {
  await db.printJob.updateMany({ where: { status: "SENT", takenAt: { lt: new Date(Date.now() - CONFIRM_MS) } }, data: { status: "FAILED", error: "The bridge took it but never said it printed.", doneAt: new Date() } });
  const job = await db.printJob.findFirst({ where: { status: "QUEUED", createdAt: { gte: new Date(Date.now() - JOB_TTL_MS) } }, orderBy: { createdAt: "asc" } });
  if (!job) return null;
  const claimed = await db.printJob.updateMany({ where: { id: job.id, status: "QUEUED" }, data: { status: "SENT", takenAt: new Date() } });
  return claimed.count === 1 ? job : null;
}

export async function finishJob(id: string, ok: boolean, error?: string) {
  const res = await db.printJob.updateMany({ where: { id, status: "SENT" }, data: { status: ok ? "PRINTED" : "FAILED", error: ok ? null : (error ?? "Unknown error").slice(0, 500), doneAt: new Date() } });
  wake();
  return res.count === 1;
}

/** Puts a failed or stuck job back in the queue (as a new job, so it gets a fresh time limit). */
export async function retryJob(id: string) {
  const job = await db.printJob.findUnique({ where: { id } });
  if (!job) return null;
  const again = await db.printJob.create({ data: { label: job.label, bytes: job.bytes } });
  await db.printJob.updateMany({ where: { id, status: { in: ["QUEUED", "SENT"] } }, data: { status: "CANCELLED", doneAt: new Date() } });
  wake();
  return again.id;
}

export async function cancelJob(id: string) {
  await db.printJob.updateMany({ where: { id, status: { in: ["QUEUED", "SENT"] } }, data: { status: "CANCELLED", doneAt: new Date() } });
}
