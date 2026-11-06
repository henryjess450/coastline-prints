"use server";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { cleanColors, TAG_SIZE_KEY } from "@/lib/receipt/price-tag";

/** Saves a product's price tag: its drawing and colours. */
export async function saveTagAction(productId: string, tag: { image: string | null; colors: string[]; priceColor: string | null }): Promise<ActionState> {
  await requireAdmin();
  const image = tag.image && /^shop\/[\w.-]+$/.test(tag.image) ? tag.image : null;
  const priceColor = tag.priceColor && /^#[0-9a-f]{6}$/i.test(tag.priceColor) ? tag.priceColor : null;
  const res = await db.shopProduct.updateMany({ where: { id: productId }, data: { tagImage: image, tagColors: JSON.stringify(cleanColors(tag.colors)), tagPriceColor: priceColor } });
  if (!res.count) return { error: "That product isn't there any more." };
  revalidatePath("/admin/price-tags");
  return { ok: true, message: "Tag saved." };
}

/** The size every tag prints at, in inches. */
export async function saveTagSizeAction(widthIn: number, heightIn: number): Promise<ActionState> {
  await requireAdmin();
  if (!(widthIn >= 1.5 && widthIn <= 8 && heightIn >= 1 && heightIn <= 6)) return { error: "Tags can be 1.5 to 8 inches wide and 1 to 6 tall." };
  const value = JSON.stringify({ widthIn: Math.round(widthIn * 100) / 100, heightIn: Math.round(heightIn * 100) / 100 });
  await db.setting.upsert({ where: { key: TAG_SIZE_KEY }, create: { key: TAG_SIZE_KEY, value }, update: { value } });
  revalidatePath("/admin/price-tags");
  return { ok: true, message: "Size saved." };
}
