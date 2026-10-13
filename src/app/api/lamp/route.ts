import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { getLampSettings, lampKeyOk, lampSeen, waitForLamp } from "@/lib/lamp/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** How long a request waits for something to play before answering empty. */
const HOLD_MS = 25_000;
/** A lamp that was offline longer than this doesn't catch up on what it missed. */
const STALE_MS = 10 * 60_000;

/**
 * The order lamp asks here what to play (firmware/lamp/main.py). The
 * request stays open until an animation is queued or HOLD_MS passes, so
 * the lamp lights up within a second of an order without hammering us.
 *
 * ?after=<id> is the last event the lamp has seen; without it (just
 * switched on) we only say where the queue is, so it doesn't replay old
 * orders. Every answer carries the dashboard's brightness and idle look.
 */
export async function GET(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`lamp:${ip}`, 30, 60_000).ok) return apiError(429, "Too many requests.");
  if (!(await lampKeyOk(req.headers.get("authorization")))) return apiError(401, "Unknown lamp key.");

  const url = new URL(req.url);
  const rssi = Number(url.searchParams.get("rssi"));
  const who = { ip, rssi: Number.isFinite(rssi) && rssi < 0 ? rssi : null, version: url.searchParams.get("v")?.slice(0, 20) ?? null };
  const newest = (await db.lampEvent.findFirst({ orderBy: { id: "desc" }, select: { id: true } }))?.id ?? 0;
  const afterRaw = url.searchParams.get("after");
  const after = afterRaw && /^\d{1,12}$/.test(afterRaw) ? Math.min(Number(afterRaw), newest) : null;

  let events: { id: number; anim: string; value: number | null }[] = [];
  if (after !== null) {
    lampSeen(who, 1);
    try {
      const until = Date.now() + HOLD_MS;
      while (!req.signal.aborted) {
        events = await db.lampEvent.findMany({ where: { id: { gt: after }, createdAt: { gte: new Date(Date.now() - STALE_MS) } }, orderBy: { id: "asc" }, take: 6, select: { id: true, anim: true, value: true } });
        if (events.length || Date.now() >= until) break;
        // Woken straight away by queueLamp; the timeout is just a safety net.
        await waitForLamp(Math.min(5_000, until - Date.now()), req.signal);
      }
    } finally {
      lampSeen(who, -1);
    }
  } else {
    lampSeen(who);
  }

  const s = await getLampSettings();
  const last = events.at(-1)?.id ?? (after === null ? newest : Math.max(after, newest));
  return NextResponse.json({ events, last, brightness: s.brightness, idle: s.idle }, { headers: { "Cache-Control": "no-store" } });
}
