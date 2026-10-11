import "server-only";
import { db } from "@/lib/db";

let cached: { value: boolean; at: number } | null = null;

/** Whether the Coastline shop has anything on sale, so links to it only show once it does. Read on every page, so cached briefly. */
export async function coastlineShopOpen() {
  if (cached && Date.now() - cached.at < 30_000) return cached.value;
  const value = (await db.shopProduct.count({ where: { shop: "coastline", active: true } }).catch(() => 0)) > 0;
  cached = { value, at: Date.now() };
  return value;
}
