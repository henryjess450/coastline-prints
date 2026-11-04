import "server-only";
import { privateSite } from "@config/private.server";
import { db } from "@/lib/db";
import { hours, dayParts, type MarketDto } from "./markets";
import { shopToday } from "./markets.server";

/*
 * LightLab orders can be picked up at a market day ("Find us at") instead
 * of the home pickup. The order keeps the market's id; everywhere that shows
 * where to pick up asks here, so a market pickup never shows the home address.
 */

/** Market days an online order can still be picked up at: from tomorrow on. */
export async function pickupMarkets(): Promise<MarketDto[]> {
  const today = shopToday();
  const rows = await db.market.findMany({ where: { date: { gt: today } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 12 });
  return rows.map((m) => ({ id: m.id, name: m.name, place: m.place, address: m.address, date: m.date, startTime: m.startTime, endTime: m.endTime, note: m.note, url: m.url }));
}

/** A market an order may be picked up at (it exists and is tomorrow or later), or null. */
export async function marketForPickup(id: string) {
  const m = await db.market.findUnique({ where: { id } });
  return m && m.date > shopToday() ? m : null;
}

export type PickupPlace = {
  /** What to show as the address: the market's place and address, or the home pickup address. */
  address: string;
  /** The market, when it's a market pickup. */
  market: { name: string; place: string; address: string; when: string; startTime: string; endTime: string } | null;
};

/** Where an order is picked up. */
export async function pickupPlaceFor(order: { pickupMarketId: string | null }): Promise<PickupPlace> {
  if (!order.pickupMarketId) return { address: privateSite.pickupAddress, market: null };
  const m = await db.market.findUnique({ where: { id: order.pickupMarketId } });
  if (!m) return { address: "At the LightLab market stand (we'll email you the details)", market: null };
  const when = `${dayParts(m.date).long}, ${hours(m)}`;
  return {
    address: [`LightLab stand at ${m.name}`, m.place, m.address].filter(Boolean).join(", "),
    market: { name: m.name, place: m.place, address: m.address, when, startTime: m.startTime, endTime: m.endTime },
  };
}
