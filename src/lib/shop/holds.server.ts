import "server-only";
import { db } from "@/lib/db";
import type { CartSnapshot } from "@/lib/orders/finalize";
import { poolKey, type ShopProductDto } from "./types";

/** A card payment that's still going through holds its stock this long. */
const CARD_HOLD_MS = 15 * 60_000;

/**
 * Stock set aside for checkouts that haven't finished paying: e-Transfers
 * until they arrive or expire, card payments for a few minutes. Keyed by
 * stock pool (see poolKey). Paid orders take their stock for real in
 * finalize, and a checkout stops holding the moment it's paid, fails or expires.
 */
export async function heldStock(products: Pick<ShopProductDto, "id" | "variants">[], now = new Date()) {
  const held = new Map<string, number>();
  if (!products.length) return held;
  const byId = new Map(products.map((p) => [p.id, p]));
  const pending = await db.checkout.findMany({
    where: {
      status: "PENDING",
      cart: { contains: '"shopLines"' },
      OR: [{ expiresAt: { gt: now } }, { expiresAt: null, createdAt: { gt: new Date(now.getTime() - CARD_HOLD_MS) } }],
    },
    select: { cart: true },
  });
  for (const co of pending) {
    const lines = (JSON.parse(co.cart) as CartSnapshot).shopLines ?? [];
    for (const l of lines) {
      const p = byId.get(l.productId);
      if (!p) continue;
      const key = poolKey(p, l.variantId);
      held.set(key, (held.get(key) ?? 0) + l.quantity);
    }
  }
  return held;
}

/** The product as shoppers should see it: stock less what's held for checkouts in progress. */
export function withHolds(p: ShopProductDto, held: Map<string, number>): ShopProductDto {
  const less = (n: number | null, key: string) => (n == null ? null : Math.max(0, n - (held.get(key) ?? 0)));
  return {
    ...p,
    stock: less(p.stock, poolKey(p, null)),
    variants: p.variants.map((v) => (v.stock == null ? v : { ...v, stock: less(v.stock, poolKey(p, v.id)) })),
  };
}
