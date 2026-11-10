"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { logError } from "@/lib/api";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { cleanHandle } from "@/lib/shop/wild.server";

export type WildState = { ok?: boolean; error?: string; id?: string };

function refresh() {
  revalidatePath("/lightlab");
  revalidatePath("/lightlab/admin/wild");
}

const key = z.string().regex(/^shop\/[a-z0-9]{16,40}\.(jpg|png|webp)$/);

/** A photo was just uploaded: put it on the wall straight away (at the front). */
export async function addWildPhotoAction(storageKey: string): Promise<WildState> {
  await requireAdmin();
  const k = key.safeParse(storageKey);
  if (!k.success) return { error: "That upload didn't work." };
  const first = await db.wildPhoto.aggregate({ _min: { sortOrder: true } });
  const row = await db.wildPhoto.create({ data: { storageKey: k.data, sortOrder: (first._min.sortOrder ?? 1) - 1 } });
  refresh();
  return { ok: true, id: row.id };
}

const updateSchema = z.object({
  id: z.string().max(40),
  handle: z.string().max(120),
  caption: z.string().trim().max(160),
  productId: z.string().max(40).nullable(),
  active: z.boolean(),
});

export async function updateWildPhotoAction(input: z.input<typeof updateSchema>): Promise<WildState> {
  await requireAdmin();
  const d = updateSchema.safeParse(input);
  if (!d.success) return { error: d.error.issues[0]?.message ?? "Check the details." };
  const handle = cleanHandle(d.data.handle);
  if (d.data.handle.trim() && !handle) return { error: "That doesn't look like an Instagram name." };
  const productId = d.data.productId && (await db.shopProduct.count({ where: { id: d.data.productId, shop: "lightlab" } })) ? d.data.productId : null;
  await db.wildPhoto.update({ where: { id: d.data.id }, data: { handle, caption: d.data.caption, productId, active: d.data.active } });
  refresh();
  return { ok: true };
}

/** New order, front to back. */
export async function reorderWildPhotosAction(ids: string[]): Promise<WildState> {
  await requireAdmin();
  await db.$transaction(ids.slice(0, 500).map((id, i) => db.wildPhoto.update({ where: { id }, data: { sortOrder: i } })));
  refresh();
  return { ok: true };
}

export async function deleteWildPhotoAction(id: string): Promise<WildState> {
  await requireAdmin();
  const row = await db.wildPhoto.findUnique({ where: { id } });
  if (!row) return { ok: true };
  await db.wildPhoto.delete({ where: { id } });
  // The file goes too, unless a product happens to use the same one.
  const used = await db.shopProduct.count({ where: { images: { contains: row.storageKey } } });
  if (!used) await getStorage().delete(row.storageKey).catch((e) => logError("wild:delete", e));
  refresh();
  return { ok: true };
}
