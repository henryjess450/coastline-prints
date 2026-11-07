/** Shared by the shop pages, the cart and the server. Money is integer CAD cents. */

/** An option of a product, like a shade colour. Its own price and stock when set. */
export type ShopVariant = {
  id: string;
  name: string;
  /** Null = the product's price. */
  priceCents: number | null;
  /** Null = the product's stock rules (made to order, or the product's count). */
  stock: number | null;
  /** A swatch colour shown next to the name. */
  hex: string | null;
};

export type ShopProductDto = {
  id: string;
  /** "lightlab" or "coastline" (config/shops.ts). */
  shop: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  /** The question for personalised products, like "Name on the keychain". */
  personalize: string | null;
  priceCents: number;
  compareAtCents: number | null;
  /** Null = made to order. */
  stock: number | null;
  variants: ShopVariant[];
  /** Image URLs, cover first. */
  images: string[];
  imageKeys: string[];
  size: { x: number; y: number; z: number };
  grams: number;
  active: boolean;
  featured: boolean;
  /** The holidays it's for (config/seasons.ts ids). */
  seasons: string[];
  /** Hidden from the shop grid while none of its seasons is the site theme. */
  seasonOnly: boolean;
  /** Product ids picked by hand as "goes well with". */
  pairings: string[];
  sortOrder: number;
};

/** Filter-pill value for "this holiday's pieces", e.g. "season:christmas". */
export const SEASON_FILTER = "season:";

/** Is this product for the holiday the site is themed for right now? */
export const inSeason = (p: Pick<ShopProductDto, "seasons">, seasonId: string) => p.seasons.includes(seasonId);

/**
 * Up to `n` products to suggest next to the given ones (a product page, or a cart):
 * hand-picked pairings first, then this season's pieces, then the same category,
 * then featured, then the rest. Never the products themselves or anything sold out.
 */
export function suggestFor(base: Pick<ShopProductDto, "id" | "category" | "pairings">[], all: ShopProductDto[], seasonId: string, n = 3) {
  const skip = new Set(base.map((b) => b.id));
  const paired = base.flatMap((b) => b.pairings);
  const cats = new Set(base.map((b) => b.category).filter(Boolean));
  const left = (p: ShopProductDto) => (p.variants.length ? p.variants.some((v) => inStock(p, v.id) !== 0) : inStock(p, null) !== 0);
  const score = (p: ShopProductDto) => {
    const pairRank = paired.indexOf(p.id);
    if (pairRank >= 0) return 1000 - pairRank;
    return (inSeason(p, seasonId) ? 300 : 0) + (cats.has(p.category) ? 100 : 0) + (p.featured ? 50 : 0);
  };
  return all
    .filter((p) => !skip.has(p.id) && left(p))
    .map((p, i) => ({ p, s: score(p), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n)
    .map((x) => x.p);
}

/** One cart line as the browser sends it. Prices are never taken from the client. */
export type ShopLineInput = { productId: string; variantId: string | null; quantity: number; /** Personalised products: the text, like a name. */ customText?: string | null };

/** Longest personalisation text (a name on a keychain). */
export const CUSTOM_TEXT_MAX = 24;

/** A priced shop line, stored on the checkout and turned into an order item. */
export type PricedShopLine = ShopLineInput & {
  name: string;
  variantName: string | null;
  unitCents: number;
  lineCents: number;
  size: { x: number; y: number; z: number };
  grams: number;
};

export const shopImageUrl = (key: string) => `/api/shop/images/${encodeURIComponent(key.replace(/^shop\//, ""))}`;

export function variantOf(p: Pick<ShopProductDto, "variants">, variantId: string | null) {
  return variantId ? (p.variants.find((v) => v.id === variantId) ?? null) : null;
}

export function unitPrice(p: Pick<ShopProductDto, "priceCents" | "variants">, variantId: string | null) {
  return variantOf(p, variantId)?.priceCents ?? p.priceCents;
}

/** How many can be bought. Null = no limit (made to order). */
export function inStock(p: Pick<ShopProductDto, "stock" | "variants">, variantId: string | null): number | null {
  const v = variantOf(p, variantId);
  if (v && v.stock != null) return v.stock;
  return p.stock;
}

/**
 * Which stock count a purchase comes out of: an option with its own count,
 * or the product's shared count (the product itself, or options without one).
 */
export function poolKey(p: Pick<ShopProductDto, "id" | "variants">, variantId: string | null) {
  const v = variantOf(p, variantId);
  return v && v.stock != null ? `${p.id}:${v.id}` : `${p.id}:*`;
}

/** Products with options need one picked. */
export function needsVariant(p: Pick<ShopProductDto, "variants">) {
  return p.variants.length > 0;
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product"
  );
}

/** The category a ?collection= link names, e.g. "xmas-26" for "Xmas 26". Unknown or ended ones give null (All). */
export function categoryFromParam(products: ShopProductDto[], param: string | string[] | undefined) {
  const want = typeof param === "string" ? slugify(param) : "";
  if (!want) return null;
  // A holiday works too: ?collection=christmas is every Christmas piece.
  if (products.some((p) => p.seasons.includes(want))) return `${SEASON_FILTER}${want}`;
  return products.find((p) => p.category && slugify(p.category) === want)?.category ?? null;
}
