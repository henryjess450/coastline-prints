/**
 * Pickup slot logic, shared by the checkout form (to show choices) and the
 * server (to validate them). Dates are plain "YYYY-MM-DD" strings in the
 * shop's time zone; times are "HH:MM" slot starts.
 */
import type { PickupConfig } from "@config/pickup";

export type PickupSlot = { time: string; label: string };
export type PickupDay = { date: string; label: string; short: string; weekday: string; slots: PickupSlot[] };

/** Today's date in the shop's time zone. */
export function todayIn(timeZone: string, now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function hourLabel(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

/** "4 to 5 pm", "11 am to 12 pm" */
function slotLabel(start: number, end: number) {
  const a = hourLabel(start);
  const b = hourLabel(end);
  const sameHalf = a.slice(-2) === b.slice(-2);
  return `${sameHalf ? a.slice(0, -3) : a} to ${b}`;
}

export function slotsFor(date: string, cfg: PickupConfig): PickupSlot[] {
  if (cfg.closedDates.includes(date)) return [];
  const hours = cfg.hours[weekdayOf(date)];
  if (!hours) return [];
  const slots: PickupSlot[] = [];
  for (let start = hours[0] * 60; start + cfg.slotMinutes <= hours[1] * 60; start += cfg.slotMinutes) {
    slots.push({ time: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`, label: slotLabel(start, start + cfg.slotMinutes) });
  }
  return slots;
}

const dayFmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...opts });

/** Days a customer can choose from, starting minLeadDays from today. */
export function availableDays(cfg: PickupConfig, now = new Date()): PickupDay[] {
  const today = todayIn(cfg.timeZone, now);
  const days: PickupDay[] = [];
  for (let i = cfg.minLeadDays; i <= cfg.maxDaysAhead; i++) {
    const date = addDays(today, i);
    const slots = slotsFor(date, cfg);
    if (!slots.length) continue;
    const dt = new Date(`${date}T12:00:00Z`);
    days.push({
      date,
      slots,
      label: dayFmt({ weekday: "long", month: "long", day: "numeric" }).format(dt),
      short: dayFmt({ month: "short", day: "numeric" }).format(dt),
      weekday: dayFmt({ weekday: "short" }).format(dt),
    });
  }
  return days;
}

/** Server-side check that a chosen slot is real and still bookable. */
export function isValidPickup(date: string, time: string, cfg: PickupConfig, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false;
  const day = availableDays(cfg, now).find((d) => d.date === date);
  return !!day?.slots.some((s) => s.time === time);
}

/** "Friday, October 10, 4 to 5 pm" */
export function formatPickup(date: string | null | undefined, time: string | null | undefined, cfg: PickupConfig) {
  if (!date || !time) return null;
  const dt = new Date(`${date}T12:00:00Z`);
  const day = dayFmt({ weekday: "long", month: "long", day: "numeric" }).format(dt);
  const [h, m] = time.split(":").map(Number);
  const start = h * 60 + m;
  return `${day}, ${slotLabel(start, start + cfg.slotMinutes)}`;
}
