import "server-only";
import { shopConfig, type ShopId } from "@config/shops";
import { getEffectiveConfig } from "@/lib/config/effective";
import type { AppConfig } from "@/lib/config/types";
import { db } from "@/lib/db";
import { CartError } from "@/lib/pricing/server-quote";
import { quoteShipping } from "@/lib/shipping/pack";
import { toProductDto } from "./products.server";
import { heldStock, withHolds } from "./holds.server";
import { inStock, needsVariant, poolKey, unitPrice, variantOf, type PricedShopLine, type ShopLineInput } from "./types";

/**
 * The authoritative price of a product cart (LightLab or the Coastline shop),
 * in the same shape as a print quote so checkout handles both alike. No order
 * fee or minimum: products are sold at their listed price. Shipping packs each
 * product's boxed size. A cart holds one shop's products, never both.
 */
export async function priceShopCart(lines: ShopLineInput[], cfg?: AppConfig) {
  const config = cfg ?? (await getEffectiveConfig());
  const rows = await db.shopProduct.findMany({ where: { id: { in: [...new Set(lines.map((l) => l.productId))] } } });
  const shop = shopConfig(rows[0]?.shop).id as ShopId;
  if (rows.some((r) => r.shop !== shop)) throw new CartError("Your cart mixes products from two shops. Please check out each one on its own.");
  // Stock held for other people's checkouts in progress (e.g. waiting for an e-Transfer) isn't for sale.
  const raw = rows.map(toProductDto);
  const held = await heldStock(raw);
  const byId = new Map(raw.map((p) => [p.id, withHolds(p, held)]));

  // Lines drawing on the same stock count (same option, or options sharing the product's count) add up.
  const wanted = new Map<string, number>();
  const shopLines: PricedShopLine[] = [];
  for (const line of lines) {
    const p = byId.get(line.productId);
    if (!p || !p.active) throw new CartError("One of the products in your cart is no longer available. Please remove it.");
    const variant = variantOf(p, line.variantId);
    if (line.variantId && !variant) throw new CartError(`That option of ${p.name} is no longer available. Please choose another.`);
    if (!variant && needsVariant(p)) throw new CartError(`Please choose an option for ${p.name}.`);
    const customText = p.personalize ? line.customText?.trim() || null : null;
    if (p.personalize && !customText) throw new CartError(`Please fill in "${p.personalize}" for ${p.name}.`);
    const key = poolKey(p, variant?.id ?? null);
    const total = (wanted.get(key) ?? 0) + line.quantity;
    wanted.set(key, total);
    const left = inStock(p, variant?.id ?? null);
    if (left != null && total > left) {
      throw new CartError(left <= 0 ? `${p.name}${variant ? ` (${variant.name})` : ""} just sold out.` : `Only ${left} of ${p.name}${variant ? ` (${variant.name})` : ""} left. Please lower the quantity.`);
    }
    const unitCents = unitPrice(p, variant?.id ?? null);
    shopLines.push({ ...line, customText, variantId: variant?.id ?? null, name: p.name, variantName: variant?.name ?? null, unitCents, lineCents: unitCents * line.quantity, size: p.size, grams: p.grams });
  }

  const subtotalCents = shopLines.reduce((s, l) => s + l.lineCents, 0);
  const shipping = quoteShipping(
    shopLines.flatMap((l) => Array.from({ length: l.quantity }, () => ({ sizeMm: l.size, grams: l.grams }))),
    config.shipping,
  );
  return {
    ok: true as const,
    shop,
    items: [],
    lines: [],
    shopLines,
    baseFeeCents: 0,
    subtotalCents,
    minimumAdjCents: 0,
    totalCents: subtotalCents,
    shipping,
    config,
  };
}
