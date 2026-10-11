import "server-only";
import { lightlab } from "@config/lightlab";
import { getEffectiveConfig } from "@/lib/config/effective";
import type { AppConfig } from "@/lib/config/types";
import { db } from "@/lib/db";
import { CartError } from "@/lib/pricing/server-quote";
import { quoteShipping } from "@/lib/shipping/pack";
import { toProductDto } from "./products.server";
import { inStock, needsVariant, unitPrice, variantOf, type PricedShopLine, type ShopLineInput } from "./types";

/**
 * The authoritative price of a LightLab cart, in the same shape as a print
 * quote so checkout handles both alike. No order fee or minimum: products are
 * sold at their listed price. Shipping packs each product's boxed size.
 */
export async function priceShopCart(lines: ShopLineInput[], cfg?: AppConfig) {
  const config = cfg ?? (await getEffectiveConfig());
  const rows = await db.shopProduct.findMany({ where: { id: { in: [...new Set(lines.map((l) => l.productId))] }, shop: lightlab.id } });
  const byId = new Map(rows.map((r) => [r.id, toProductDto(r)]));

  // The same product and option twice counts against stock once.
  const wanted = new Map<string, number>();
  const shopLines: PricedShopLine[] = [];
  for (const line of lines) {
    const p = byId.get(line.productId);
    if (!p || !p.active) throw new CartError("One of the products in your cart is no longer available. Please remove it.");
    const variant = variantOf(p, line.variantId);
    if (line.variantId && !variant) throw new CartError(`That option of ${p.name} is no longer available. Please choose another.`);
    if (!variant && needsVariant(p)) throw new CartError(`Please choose an option for ${p.name}.`);
    const key = `${p.id}:${variant?.id ?? ""}`;
    const total = (wanted.get(key) ?? 0) + line.quantity;
    wanted.set(key, total);
    const left = inStock(p, variant?.id ?? null);
    if (left != null && total > left) {
      throw new CartError(left <= 0 ? `${p.name}${variant ? ` (${variant.name})` : ""} just sold out.` : `Only ${left} of ${p.name}${variant ? ` (${variant.name})` : ""} left. Please lower the quantity.`);
    }
    const unitCents = unitPrice(p, variant?.id ?? null);
    shopLines.push({ ...line, variantId: variant?.id ?? null, name: p.name, variantName: variant?.name ?? null, unitCents, lineCents: unitCents * line.quantity, size: p.size, grams: p.grams });
  }

  const subtotalCents = shopLines.reduce((s, l) => s + l.lineCents, 0);
  const shipping = quoteShipping(
    shopLines.flatMap((l) => Array.from({ length: l.quantity }, () => ({ sizeMm: l.size, grams: l.grams }))),
    config.shipping,
  );
  return {
    ok: true as const,
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
