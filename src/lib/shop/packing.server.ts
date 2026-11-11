import "server-only";
import { pickup } from "@config/pickup";
import { db } from "@/lib/db";
import type { ShopVariant } from "./types";
import { parsePacked } from "./stand.server";

/*
 * The packing list for a market day: online orders to bring for pickup,
 * how many of each lamp to bring (from stock and what sold at this market
 * last time), and the stand kit, which the owner edits.
 */

const KIT_KEY = "packing-kit";
export const DEFAULT_KIT = [
  "Receipt printer + power cable",
  "2 spare paper rolls",
  "Mac + charger",
  "USB-C ethernet adapter + ethernet cable",
  "iPad + charger",
  "Card reader (charged)",
  "Cash float",
  "Extension cord + power bar",
  "Table + tablecloth",
  "Lamp stands and risers",
  "Price tags",
  "Bags and tissue paper",
  "Business cards",
];

export async function getKit(): Promise<string[]> {
  const row = await db.setting.findUnique({ where: { key: KIT_KEY } });
  try {
    const list = row ? (JSON.parse(row.value) as unknown) : null;
    return Array.isArray(list) && list.every((x) => typeof x === "string") ? list : DEFAULT_KIT;
  } catch {
    return DEFAULT_KIT;
  }
}

export async function saveKit(items: string[]) {
  const value = JSON.stringify(items.map((s) => s.trim()).filter(Boolean).slice(0, 60).map((s) => s.slice(0, 80)));
  await db.setting.upsert({ where: { key: KIT_KEY }, create: { key: KIT_KEY, value }, update: { value } });
}

const dayOf = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: pickup.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export type PackLine = {
  key: string;
  name: string;
  option: string;
  /** On hand (null = made to order). */
  stock: number | null;
  /** Sold at this market the last time it ran (null = no sales there yet). */
  lastTime: number | null;
  /** How many to bring. */
  bring: number;
};

export type PackPickup = { orderNumber: string; orderId: string; name: string; items: string[]; ready: boolean };

export type PackingList = {
  market: { id: string; name: string; place: string; date: string; startTime: string; endTime: string };
  /** The last day this market ran with sales, "YYYY-MM-DD". */
  lastDate: string | null;
  lastTotalCents: number;
  pickups: PackPickup[];
  lines: PackLine[];
  /** Lamps ticked as packed, by line key: these show on the shop as "At <market>". */
  packed: Record<string, number>;
  kit: string[];
};

/**
 * How many to bring: half again what sold last time (at least 2), or 3 of
 * each when there's no history yet, never more than are on hand. Made-to-
 * order lamps get one to show.
 */
function suggest(stock: number | null, lastTime: number | null) {
  if (stock === null) return 1;
  const want = lastTime ? Math.max(2, Math.ceil(lastTime * 1.5)) : 3;
  return Math.max(0, Math.min(stock, want));
}

export async function packingList(marketId: string): Promise<PackingList | null> {
  const market = await db.market.findUnique({ where: { id: marketId } });
  if (!market) return null;

  // Sales at this market: register sales are recorded with the market's name as their source.
  const sales = (
    await db.order.findMany({
      where: { source: market.name },
      select: { createdAt: true, totalCents: true, items: { select: { productId: true, variantId: true, quantity: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    })
  ).filter((o) => dayOf(o.createdAt) < market.date);
  const lastDate = sales.length ? dayOf(sales[0].createdAt) : null;
  const lastSales = lastDate ? sales.filter((o) => dayOf(o.createdAt) === lastDate) : [];
  const soldLast = new Map<string, number>();
  for (const o of lastSales) for (const i of o.items) if (i.productId) soldLast.set(`${i.productId}:${i.variantId ?? ""}`, (soldLast.get(`${i.productId}:${i.variantId ?? ""}`) ?? 0) + i.quantity);

  const products = await db.shopProduct.findMany({ where: { shop: "lightlab", active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const lines: PackLine[] = [];
  for (const p of products) {
    const variants = JSON.parse(p.variants) as ShopVariant[];
    // Options with their own count are packed one by one; the rest share the product's count.
    const own = variants.filter((v) => v.stock !== null);
    for (const v of own) {
      const last = soldLast.get(`${p.id}:${v.id}`) ?? (lastDate ? 0 : null);
      lines.push({ key: `${p.id}:${v.id}`, name: p.name, option: v.name, stock: v.stock, lastTime: last, bring: suggest(v.stock, last) });
    }
    if (own.length < variants.length || variants.length === 0) {
      const shared = variants.filter((v) => v.stock === null);
      const last = lastDate ? [...soldLast.entries()].filter(([k]) => k.startsWith(`${p.id}:`) && !own.some((v) => k === `${p.id}:${v.id}`)).reduce((n, [, q]) => n + q, 0) : null;
      lines.push({ key: `${p.id}:`, name: p.name, option: shared.length ? shared.map((v) => v.name).join(", ") : "", stock: p.stock, lastTime: last, bring: suggest(p.stock, last) });
    }
  }

  const orders = await db.order.findMany({
    where: { pickupMarketId: market.id, status: { notIn: ["PICKED_UP", "CANCELLED", "REFUNDED"] } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  return {
    market: { id: market.id, name: market.name, place: market.place, date: market.date, startTime: market.startTime, endTime: market.endTime },
    lastDate,
    lastTotalCents: lastSales.reduce((n, o) => n + o.totalCents, 0),
    pickups: orders.map((o) => ({ orderNumber: o.orderNumber, orderId: o.id, name: o.customerName, items: o.items.map((i) => `${i.quantity} × ${i.fileName}${i.colorName ? ` (${i.colorName})` : ""}`), ready: o.status === "READY_FOR_PICKUP" })),
    lines,
    packed: parsePacked(market.packed),
    kit: await getKit(),
  };
}
