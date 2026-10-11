import "server-only";
import { pickup } from "@config/pickup";
import { db } from "@/lib/db";
import type { MarketDto } from "./markets";

/** Today in the shop's time zone, "YYYY-MM-DD". */
export const shopToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: pickup.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

const pick = (m: MarketDto): MarketDto => ({ id: m.id, name: m.name, place: m.place, address: m.address, date: m.date, startTime: m.startTime, endTime: m.endTime, note: m.note, url: m.url });

/** Markets from today on, soonest first. Past ones drop off by themselves. */
export async function upcomingMarkets(limit = 8) {
  const rows = await db.market.findMany({ where: { date: { gte: shopToday() } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: limit });
  return rows.map(pick);
}

/** For the admin: upcoming first, then the most recent past ones. */
export async function allMarkets() {
  const today = shopToday();
  const [upcoming, past] = await Promise.all([
    db.market.findMany({ where: { date: { gte: today } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] }),
    db.market.findMany({ where: { date: { lt: today } }, orderBy: [{ date: "desc" }], take: 10 }),
  ]);
  return { upcoming: upcoming.map(pick), past: past.map(pick) };
}
