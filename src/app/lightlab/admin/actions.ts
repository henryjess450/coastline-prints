"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { lightlab } from "@config/lightlab";
import { seasons, type SeasonId } from "@config/seasons";
import { SHOP_IDS, shopConfig } from "@config/shops";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin/auth";
import { logError } from "@/lib/api";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { slugify } from "@/lib/shop/types";
import { queueRestockEmails } from "@/lib/shop/emails";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { setShopShips } from "@/lib/shop/shipping-switch.server";

export type ShopActionState = { ok?: boolean; error?: string; message?: string; id?: string };

const cents = z.number().int().min(0).max(10_000_000);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const variantSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{4,24}$/).optional(),
  name: z.string().trim().min(1, "Every option needs a name.").max(60),
  priceCents: cents.nullable(),
  stock: z.number().int().min(0).max(100_000).nullable(),
  hex: hex.nullable(),
  /** Photos (storage keys) that show this option. */
  imageKeys: z.array(z.string().max(80)).max(30).default([]),
});

const productSchema = z.object({
  id: z.string().max(40).nullable(),
  /** Which shop a new product goes in. An existing product stays in its shop. */
  shop: z.enum(SHOP_IDS).default("lightlab"),
  /** The question for personalised products ("Name on the keychain"). Empty = not personalised. */
  personalize: z.string().trim().max(60).nullable().default(null).transform((t) => t || null),
  name: z.string().trim().min(1, "Give the product a name.").max(100),
  slug: z.string().trim().max(60),
  tagline: z.string().trim().max(160),
  description: z.string().trim().max(5000),
  category: z.string().trim().max(40),
  priceCents: cents,
  compareAtCents: cents.nullable(),
  stock: z.number().int().min(0).max(100_000).nullable(),
  variants: z.array(variantSchema).max(30),
  images: z.array(z.string().regex(/^shop\/[a-z0-9]{16,40}\.(jpg|png|webp)$/)).max(lightlab.maxImagesPerProduct),
  sizeXMm: z.number().min(1).max(2000),
  sizeYMm: z.number().min(1).max(2000),
  sizeZMm: z.number().min(1).max(2000),
  grams: z.number().min(1).max(50_000),
  active: z.boolean(),
  featured: z.boolean(),
  seasons: z.array(z.enum(seasons.map((x) => x.id) as [SeasonId, ...SeasonId[]])).max(12).default([]),
  seasonOnly: z.boolean().default(false),
  pairings: z.array(z.string().max(40)).max(6).default([]),
  addon: z.boolean().default(false),
  editionSize: z.number().int().min(1).max(100_000).nullable().default(null),
  dropAt: z.string().datetime().nullable().default(null),
});

export type ProductInput = z.infer<typeof productSchema>;

/** Refreshes a shop's pages (both shops when it's not known, like after reordering). */
function revalidateShop(slug?: string, shopId?: string) {
  for (const s of shopId ? [shopConfig(shopId)] : SHOP_IDS.map(shopConfig)) {
    revalidatePath(s.base);
    revalidatePath(s.admin);
    if (slug) revalidatePath(`${s.base}/${slug}`);
  }
}

/** A slug nobody else is using: "tide-lamp", then "tide-lamp-2", ... */
async function freeSlug(wanted: string, selfId: string | null) {
  const base = slugify(wanted);
  for (let n = 1; n < 200; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const taken = await db.shopProduct.findUnique({ where: { slug }, select: { id: true } });
    if (!taken || taken.id === selfId) return slug;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/** Photos taken off a product (or never saved to one) are removed from storage. */
async function dropImages(keys: string[]) {
  await Promise.all(keys.map((k) => getStorage().delete(k).catch(() => undefined)));
}

export async function saveProductAction(input: ProductInput): Promise<ShopActionState> {
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Some details aren't valid." };
  const d = parsed.data;
  if (d.compareAtCents != null && d.compareAtCents <= d.priceCents) return { error: "The \"was\" price has to be higher than the price, or left empty." };
  const names = d.variants.map((v) => v.name.toLowerCase());
  if (new Set(names).size !== names.length) return { error: "Two options have the same name." };
  if (d.editionSize != null && d.id) {
    const sold = (await db.shopProduct.findUnique({ where: { id: d.id }, select: { editionSold: true } }))?.editionSold ?? 0;
    if (d.editionSize < sold) return { error: `${sold} of the run are already sold, so it can't be smaller than that.` };
  }

  try {
    const existing = d.id ? await db.shopProduct.findUnique({ where: { id: d.id } }) : null;
    if (d.id && !existing) return { error: "That product was deleted." };
    const slug = await freeSlug(d.slug || d.name, d.id);
    const shop = existing?.shop ?? d.shop;
    const data = {
      addon: d.addon,
      editionSize: d.editionSize,
      dropAt: d.dropAt ? new Date(d.dropAt) : null,
      shop,
      personalize: d.personalize,
      slug,
      name: d.name,
      tagline: d.tagline,
      description: d.description,
      category: d.category,
      priceCents: d.priceCents,
      compareAtCents: d.compareAtCents,
      stock: d.stock,
      // Keep option ids stable so carts and past orders still match.
      variants: JSON.stringify(d.variants.map((v) => ({ ...v, id: v.id ?? randomBytes(5).toString("hex"), imageKeys: v.imageKeys.filter((k) => d.images.includes(k)) }))),
      images: JSON.stringify(d.images),
      sizeXMm: d.sizeXMm,
      sizeYMm: d.sizeYMm,
      sizeZMm: d.sizeZMm,
      grams: d.grams,
      active: d.active,
      featured: d.featured,
      seasons: JSON.stringify([...new Set(d.seasons)]),
      seasonOnly: d.seasonOnly && d.seasons.length > 0,
      // Only real products in the same shop, never itself.
      pairings: JSON.stringify(
        (await db.shopProduct.findMany({ where: { id: { in: d.pairings }, shop }, select: { id: true } })).map((r) => r.id).filter((id) => id !== d.id).sort((a, b) => d.pairings.indexOf(a) - d.pairings.indexOf(b)),
      ),
    };
    const saved = existing
      ? await db.shopProduct.update({ where: { id: existing.id }, data })
      : await db.shopProduct.create({ data: { ...data, sortOrder: ((await db.shopProduct.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1 } });
    if (existing) {
      const before = JSON.parse(existing.images) as string[];
      await dropImages(before.filter((k) => !d.images.includes(k)));
      if (existing.slug !== slug) revalidatePath(`${shopConfig(shop).base}/${existing.slug}`);
    }
    revalidateShop(slug, shop);
    const told = await restocked(saved.id);
    return { ok: true, id: saved.id, message: (existing ? "Saved." : "Product added.") + told };
  } catch (err) {
    logError("lightlab:save", err);
    return { error: "Couldn't save the product." };
  }
}

/** Back in stock: email the people who asked. Returns a note for the admin ("" if nobody was waiting). */
async function restocked(productId: string) {
  try {
    const n = await queueRestockEmails(productId);
    if (!n) return "";
    sendNotificationsSoon("lightlab-restock");
    return ` Emailing ${n} ${n === 1 ? "person" : "people"} that it's back.`;
  } catch (err) {
    logError("lightlab:restock", err);
    return "";
  }
}

/** Photos uploaded in the editor but never saved (e.g. the editor was closed). */
export async function discardImagesAction(keys: string[]) {
  await requireAdmin();
  const valid = keys.filter((k) => /^shop\/[a-z0-9]{16,40}\.(jpg|png|webp)$/.test(k));
  // Never delete a photo that a saved product uses.
  const used = new Set((await db.shopProduct.findMany({ select: { images: true } })).flatMap((p) => JSON.parse(p.images) as string[]));
  await dropImages(valid.filter((k) => !used.has(k)));
}

/** Past orders keep their line (name, price) but lose the link to the product. */
export async function deleteProductAction(id: string): Promise<ShopActionState> {
  await requireAdmin();
  const p = await db.shopProduct.findUnique({ where: { id }, include: { files: { select: { storageKey: true } } } });
  if (!p) return { ok: true };
  await db.shopProduct.delete({ where: { id } });
  await dropImages(JSON.parse(p.images) as string[]);
  // Its print files go too (the rows cascade with the product).
  await Promise.all(p.files.map((f) => getStorage().delete(f.storageKey).catch(() => undefined)));
  revalidateShop(p.slug, p.shop);
  return { ok: true, message: `${p.name} deleted.` };
}

const quickSchema = z.object({
  priceCents: cents.optional(),
  stock: z.number().int().min(0).max(100_000).nullable().optional(),
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
});

/** The list page's inline edits: price, stock, shown/hidden, featured. */
export async function quickUpdateAction(id: string, patch: z.infer<typeof quickSchema>): Promise<ShopActionState> {
  await requireAdmin();
  const parsed = quickSchema.safeParse(patch);
  if (!parsed.success) return { error: "That value isn't valid." };
  try {
    const p = await db.shopProduct.findUnique({ where: { id } });
    if (!p) return { error: "That product was deleted." };
    if (parsed.data.priceCents != null && p.compareAtCents != null && p.compareAtCents <= parsed.data.priceCents) {
      // Raising the price past the "was" price ends the markdown.
      await db.shopProduct.update({ where: { id }, data: { ...parsed.data, compareAtCents: null } });
    } else {
      await db.shopProduct.update({ where: { id }, data: parsed.data });
    }
    revalidateShop(p.slug, p.shop);
    return { ok: true, message: await restocked(id) };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return { error: "That product was deleted." };
    logError("lightlab:quick", err);
    return { error: "Couldn't save that." };
  }
}

/** Saves the shop order after dragging or moving products. */
export async function reorderProductsAction(ids: string[]): Promise<ShopActionState> {
  await requireAdmin();
  const list = z.array(z.string().max(40)).max(500).safeParse(ids);
  if (!list.success) return { error: "Couldn't reorder." };
  await db.$transaction(list.data.map((id, i) => db.shopProduct.updateMany({ where: { id }, data: { sortOrder: i + 1 } })));
  revalidateShop();
  return { ok: true };
}

/** Turn shipping on or off for a shop (off = pickup and markets only). */
export async function setShopShippingAction(shopId: string, on: boolean): Promise<ShopActionState> {
  await requireAdmin();
  const shop = shopConfig(shopId);
  try {
    await setShopShips(shop.id, on);
    revalidateShop(undefined, shop.id);
    return { ok: true, message: on ? "Shipping is on." : "Pickup only. Shipping is off." };
  } catch (err) {
    logError("lightlab:shipping", err);
    return { error: "Couldn't change shipping." };
  }
}
