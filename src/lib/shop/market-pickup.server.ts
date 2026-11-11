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

/**
 * Market days an online order can be picked up at: none. The owner stopped
 * bringing orders to markets (2026-11-11); lamps already at the stand are
 * reserved with a free hold instead (stand.server.ts). Orders placed before
 * still show their market below.
 */
export async function pickupMarkets(): Promise<MarketDto[]> {
  return [];
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
