import "server-only";
import { shopConfig, type ShopId } from "@config/shops";
import { db } from "@/lib/db";

/** Each shop can stop shipping (pickup only) from its admin. On unless switched off. */
const key = (shop: ShopId) => `shop-shipping:${shop}`;
let cached = new Map<ShopId, { on: boolean; at: number }>();

export async function shopShips(shop: ShopId): Promise<boolean> {
  const hit = cached.get(shop);
  if (hit && Date.now() - hit.at < 10_000) return hit.on;
  const row = await db.setting.findUnique({ where: { key: key(shop) } }).catch(() => null);
  const on = row?.value !== "off";
  cached.set(shop, { on, at: Date.now() });
  return on;
}

export async function setShopShips(shop: ShopId, on: boolean) {
  if (on) await db.setting.deleteMany({ where: { key: key(shop) } });
  else await db.setting.upsert({ where: { key: key(shop) }, create: { key: key(shop), value: "off" }, update: { value: "off" } });
  cached = new Map();
}

export const pickupOnlyReason = (shop: ShopId) => `${shopConfig(shop).name} is pickup only right now.`;
