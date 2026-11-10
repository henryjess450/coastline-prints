import "server-only";
import { db } from "@/lib/db";
import { shopImageUrl } from "./types";

/** A customer's photo of their lamp at home, as the shop shows it. */
export type WildPhotoDto = { id: string; key: string; url: string; handle: string; caption: string; productId: string | null; active: boolean };

const toDto = (w: { id: string; storageKey: string; handle: string; caption: string; productId: string | null; active: boolean }): WildPhotoDto => ({ id: w.id, key: w.storageKey, url: shopImageUrl(w.storageKey), handle: w.handle, caption: w.caption, productId: w.productId, active: w.active });

const order = [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }];

/** On the shop: shown photos, newest first within the owner's order. `productId` = only that lamp's. */
export async function wildPhotos({ productId, limit = 24 }: { productId?: string; limit?: number } = {}) {
  return (await db.wildPhoto.findMany({ where: { active: true, ...(productId ? { productId } : {}) }, orderBy: order, take: limit })).map(toDto);
}

export async function allWildPhotos() {
  return (await db.wildPhoto.findMany({ orderBy: order })).map(toDto);
}

/** "@name" or "name" or an Instagram link → "name". Empty stays empty. */
export function cleanHandle(raw: string) {
  const s = raw.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : "";
}
