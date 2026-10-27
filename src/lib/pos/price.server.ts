import "server-only";
import type { PromoCode } from "@/generated/prisma/client";
import { applyCodes, type AppliedCode } from "@/lib/codes/apply";
import { lookupCodes, toCodeInfo } from "@/lib/codes/server";
import { getEffectiveConfig } from "@/lib/config/effective";
import type { CartSnapshot } from "@/lib/orders/finalize";
import { CartError, priceCart } from "@/lib/pricing/server-quote";
import { db } from "@/lib/db";
import { priceShopCart } from "@/lib/shop/price.server";
import { shopImageUrl } from "@/lib/shop/types";
import type { PosCartInput, PosLineView, PosQuote } from "./types";
import { posCartSchema } from "./types";

export type PricedPos = PosQuote & {
  snapshot: CartSnapshot;
  applied: AppliedCode[];
  records: PromoCode[];
  discountCents: number;
  giftCardCents: number;
};

/**
 * The register's price, from the same pieces as online checkout: priceCart
 * for prints (with its order fee and minimum), priceShopCart for products,
 * plus custom lines at the price typed in. Then coupons and gift cards.
 * The site-wide sale is an online promotion and isn't applied here.
 */
export async function pricePos(raw: PosCartInput): Promise<PricedPos> {
  const cart = posCartSchema.parse(raw);
  const empty = (error: string): PricedPos => ({ ok: false, error, lines: [], fees: [], discounts: [], rejected: [], totalCents: 0, snapshot: { lines: [], quote: { items: [], baseFeeCents: 0, subtotalCents: 0, minimumAdjCents: 0, totalCents: 0 } }, applied: [], records: [], discountCents: 0, giftCardCents: 0 });
  if (!cart.items.length && !cart.products.length && !cart.custom.length) return empty("The cart is empty.");

  const config = await getEffectiveConfig();
  let prints, shop;
  try {
    prints = cart.items.length ? await priceCart(cart.items, config) : null;
    shop = cart.products.length ? await priceShopCart(cart.products, config) : null;
  } catch (err) {
    if (err instanceof CartError) return empty(err.message);
    throw err;
  }
  if (shop && shop.shop !== cart.brand) return empty(`Those products are from the other shop. Switch the register to ${shop.shop === "lightlab" ? "LightLab" : "Coastline Prints"}.`);

  // Each product's cover photo, for the thumbnails on the register and display.
  const covers = new Map(
    shop
      ? (await db.shopProduct.findMany({ where: { id: { in: shop.shopLines.map((l) => l.productId) } }, select: { id: true, images: true } })).map((p) => {
          const first = (JSON.parse(p.images) as string[])[0];
          return [p.id, first ? shopImageUrl(first) : undefined];
        })
      : [],
  );
  const hexOf = (material: string, colorId: string) => config.materials.find((m) => m.id === material)?.colors.find((c) => c.id === colorId)?.hex;
  const lines: PosLineView[] = [
    ...(prints?.lines ?? []).map((l, i) => {
      const q = prints!.items[i];
      return { key: `print-${i}`, kind: "print" as const, name: l.fileName, detail: `${l.material} · ${l.colorName}`, quantity: l.quantity, cents: q.ok ? q.lineCents : null, error: q.ok ? undefined : q.error, swatch: hexOf(l.material, l.colorId) };
    }),
    ...(shop?.shopLines ?? []).map((l, i) => ({ key: `product-${i}`, kind: "product" as const, name: l.name, detail: [l.variantName, l.customText && `"${l.customText}"`].filter(Boolean).join(" · ") || undefined, quantity: l.quantity, cents: l.lineCents, image: covers.get(l.productId) })),
    ...cart.custom.map((c, i) => ({ key: `custom-${i}`, kind: "custom" as const, name: c.name, quantity: c.quantity, cents: c.unitCents * c.quantity })),
  ];
  const customCents = cart.custom.reduce((s, c) => s + c.unitCents * c.quantity, 0);
  const fees = [...(prints?.baseFeeCents ? [{ label: "Order fee", cents: prints.baseFeeCents }] : []), ...(prints?.minimumAdjCents ? [{ label: "Minimum order top-up", cents: prints.minimumAdjCents }] : [])];
  const beforeCodes = (prints?.totalCents ?? 0) + (shop?.totalCents ?? 0) + customCents;
  const printsOk = !prints || prints.ok;

  const { records, errors } = await lookupCodes(cart.codes, new Date(), null, cart.email || null);
  const discount = applyCodes(beforeCodes, records.map(toCodeInfo), 0, null);
  const rejected = [...errors, ...discount.rejected];
  const usable = records.filter((r) => discount.applied.some((a) => a.code === r.code));

  const snapshot: CartSnapshot = {
    lines: prints?.lines ?? [],
    shopLines: shop?.shopLines,
    customLines: cart.custom.map((c) => ({ ...c, lineCents: c.unitCents * c.quantity })),
    shop: cart.brand,
    quote: {
      items: prints?.items ?? [],
      baseFeeCents: prints?.baseFeeCents ?? 0,
      minimumAdjCents: prints?.minimumAdjCents ?? 0,
      subtotalCents: (prints?.subtotalCents ?? 0) + (shop?.subtotalCents ?? 0) + customCents,
      totalCents: beforeCodes,
      shipping: null,
    },
  };
  return {
    ok: printsOk && rejected.length === 0,
    error: !printsOk ? "One of the prints can't be printed." : rejected[0] ? `${rejected[0].code}: ${rejected[0].reason}` : undefined,
    lines,
    fees,
    discounts: discount.applied.map((a) => ({ label: a.label, cents: a.amountCents })),
    rejected,
    totalCents: discount.totalCents,
    snapshot,
    applied: discount.applied,
    records: usable,
    discountCents: discount.discountCents,
    giftCardCents: discount.giftCardCents,
  };
}

/** The quote without the server-only parts, for the register. */
export function publicQuote(p: PricedPos): PosQuote {
  return { ok: p.ok, error: p.error, lines: p.lines, fees: p.fees, discounts: p.discounts, rejected: p.rejected, totalCents: p.totalCents };
}
