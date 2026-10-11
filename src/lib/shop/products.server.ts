import "server-only";
import type { ShopProduct } from "@/generated/prisma/client";
import { lightlab } from "@config/lightlab";
import { db } from "@/lib/db";
import { heldStock, withHolds } from "./holds.server";
import { shopImageUrl, type ShopProductDto, type ShopVariant } from "./types";

function parse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function toProductDto(p: ShopProduct): ShopProductDto {
  const keys = parse<string[]>(p.images, []);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    category: p.category,
    priceCents: p.priceCents,
    compareAtCents: p.compareAtCents,
    stock: p.stock,
    variants: parse<ShopVariant[]>(p.variants, []),
    images: keys.map(shopImageUrl),
    imageKeys: keys,
    size: { x: p.sizeXMm, y: p.sizeYMm, z: p.sizeZMm },
    grams: p.grams,
    active: p.active,
    featured: p.featured,
    sortOrder: p.sortOrder,
  };
}

const order = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];

/** What the shop shows: active products only, unless it's the admin asking. */
export async function listProducts({ all = false } = {}) {
  const rows = await db.shopProduct.findMany({ where: { shop: lightlab.id, ...(all ? {} : { active: true }) }, orderBy: order });
  const products = rows.map(toProductDto);
  // The admin sees real stock; shoppers see what's left after checkouts in progress.
  if (all) return products;
  const held = await heldStock(products);
  return products.map((p) => withHolds(p, held));
}

export async function productBySlug(slug: string) {
  const p = await db.shopProduct.findUnique({ where: { slug } });
  if (!p || p.shop !== lightlab.id || !p.active) return null;
  const dto = toProductDto(p);
  return withHolds(dto, await heldStock([dto]));
}
