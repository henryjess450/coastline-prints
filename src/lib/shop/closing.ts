import { pickup } from "@config/pickup";
import { clock } from "./markets";

/** A market the stand is at today and when it ends ("HH:MM", shop time zone). */
export type Closing = { date: string; endTime: string };

/** The last hour of the stand's day. */
const LAST_MS = 60;

/**
 * Minutes until we pack up, during a market's last hour today; null any
 * other time. With two markets today, the one ending soonest.
 */
export function closingIn(markets: Closing[], now = new Date()): { minutes: number; endTime: string } | null {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: pickup.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  const nowMin = Number(get("hour")) * 60 + Number(get("minute"));
  let best: { minutes: number; endTime: string } | null = null;
  for (const m of markets) {
    if (m.date !== today) continue;
    const [h, mm] = m.endTime.split(":").map(Number);
    const left = h * 60 + mm - nowMin;
    if (left > 0 && left <= LAST_MS && (!best || left < best.minutes)) best = { minutes: left, endTime: m.endTime };
  }
  return best;
}

/** "We pack up at 3. Last chance today!" */
export const closingLine = (endTime: string) => `We pack up at ${clock(endTime).replace(/ (am|pm)$/, "")}. Last chance today!`;
