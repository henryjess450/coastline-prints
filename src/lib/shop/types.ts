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
  /** Storage keys of the product photos that show this option. Photos no option claims are shared. */
  imageKeys?: string[];
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
  /** An add-on (spare bulb, smart bulb...): a one-tap extra in the cart, kept off the shop grid. */
  addon: boolean;
  /** Numbered limited run: how many will ever be sold. Null = not limited. */
  editionSize: number | null;
  /** Numbers of the run already taken (or held for checkouts in progress). */
  editionSold: number;
  /** ISO time it goes on sale. Null = on sale now. */
  dropAt: string | null;
};

/** Not out yet: a drop date still to come. */
export const notDropped = (p: Pick<ShopProductDto, "dropAt">, now = Date.now()) => !!p.dropAt && new Date(p.dropAt).getTime() > now;

/** How many numbers of a limited run are left. Null = not a limited run. */
export const editionLeft = (p: Pick<ShopProductDto, "editionSize" | "editionSold">) => (p.editionSize == null ? null : Math.max(0, p.editionSize - p.editionSold));

/** "No. 7 of 25", or "No. 7 to 9 of 25" for a few at once. */
export const editionLabel = (from: number, to: number, size: number) => (to > from ? `No. ${from} to ${to} of ${size}` : `No. ${from} of ${size}`);

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
  const left = (p: ShopProductDto) => !p.addon && !notDropped(p) && (p.variants.length ? p.variants.some((v) => inStock(p, v.id) !== 0) : inStock(p, null) !== 0);
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

/**
 * The photos to show for a chosen option, as URLs: the ones tagged with it
 * first, then the shared (untagged) ones. Photos of other options are left out,
 * unless the option has none of its own: then everything shows, shared first,
 * and `picturedIn` names the option the first photo actually shows.
 */
export function photosFor(p: Pick<ShopProductDto, "images" | "imageKeys" | "variants">, variantId: string | null): { images: string[]; picturedIn: ShopVariant | null } {
  const tagged = new Map<string, ShopVariant[]>();
  for (const v of p.variants) for (const k of v.imageKeys ?? []) tagged.set(k, [...(tagged.get(k) ?? []), v]);
  const v = variantOf(p, variantId);
  if (!v || !tagged.size) return { images: p.images, picturedIn: null };
  const idx = p.imageKeys.map((_, i) => i);
  const own = idx.filter((i) => tagged.get(p.imageKeys[i])?.some((t) => t.id === v.id));
  const shared = idx.filter((i) => !tagged.has(p.imageKeys[i]));
  if (own.length) return { images: [...own, ...shared].map((i) => p.images[i]), picturedIn: null };
  const others = idx.filter((i) => tagged.has(p.imageKeys[i]));
  const order = [...shared, ...others];
  return { images: order.map((i) => p.images[i]), picturedIn: order.length ? (tagged.get(p.imageKeys[order[0]])?.[0] ?? null) : null };
}

/** The option a photo (by URL) is tagged with, when it's exactly one. Shared and group photos give null. */
export function variantForPhoto(p: Pick<ShopProductDto, "images" | "imageKeys" | "variants">, url: string): ShopVariant | null {
  const key = p.imageKeys[p.images.indexOf(url)];
  if (!key) return null;
  const vs = p.variants.filter((v) => v.imageKeys?.includes(key));
  return vs.length === 1 ? vs[0] : null;
}

/** The option a ?colour= link names (by name, like "dark-blue", or by id). */
export function variantFromParam(p: Pick<ShopProductDto, "variants">, param: string | string[] | undefined) {
  const want = typeof param === "string" ? param.trim().toLowerCase() : "";
  if (!want) return null;
  return p.variants.find((v) => v.id === want || slugify(v.name) === slugify(want)) ?? null;
}

export function variantOf(p: Pick<ShopProductDto, "variants">, variantId: string | null) {
  return variantId ? (p.variants.find((v) => v.id === variantId) ?? null) : null;
}

export function unitPrice(p: Pick<ShopProductDto, "priceCents" | "variants">, variantId: string | null) {
  return variantOf(p, variantId)?.priceCents ?? p.priceCents;
}

/** How many can be bought. Null = no limit (made to order). */
export function inStock(p: Pick<ShopProductDto, "stock" | "variants"> & Partial<Pick<ShopProductDto, "editionSize" | "editionSold">>, variantId: string | null): number | null {
  const v = variantOf(p, variantId);
  const n = v && v.stock != null ? v.stock : p.stock;
  // A limited run can't sell past its last number, whatever the counts say.
  const run = p.editionSize == null ? null : Math.max(0, p.editionSize - (p.editionSold ?? 0));
  return run == null ? n : n == null ? run : Math.min(n, run);
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
