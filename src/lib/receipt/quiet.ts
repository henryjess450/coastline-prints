import { pickup } from "@config/pickup";
import { receiptQuietHours } from "@config/printers";
import { addDays, atShopHour, hourIn, todayIn } from "@/lib/pickup";

/**
 * When a new-order ticket may print: now, or (overnight) the end of the
 * printer's quiet hours. Returns null when it can print straight away.
 */
export function quietUntil(now = new Date(), quiet = receiptQuietHours, timeZone = pickup.timeZone): Date | null {
  const hour = hourIn(timeZone, now);
  // The window wraps past midnight (22 to 7), or sits inside one day (1 to 6).
  const inQuiet = quiet.from > quiet.until ? hour >= quiet.from || hour < quiet.until : hour >= quiet.from && hour < quiet.until;
  if (!inQuiet) return null;
  const today = todayIn(timeZone, now);
  // Before midnight the morning is tomorrow; after midnight it's today.
  return atShopHour(hour >= quiet.until ? addDays(today, 1) : today, quiet.until, timeZone);
}
