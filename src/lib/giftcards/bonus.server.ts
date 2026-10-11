import "server-only";
import { z } from "zod";
import { defaultGiftBonus, type GiftBonus } from "@config/promotions";
import { db } from "@/lib/db";

const KEY = "giftBonus";
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const giftBonusSchema = z.object({
  on: z.boolean(),
  name: z.string().trim().min(2).max(40),
  minCents: z.number().int().min(0).max(50000),
  bonusCents: z.number().int().min(0).max(10000),
  startsOn: day,
  endsOn: day,
});

/** The gift card bonus as set in admin, or the default from config/promotions.ts. */
export async function getGiftBonus(): Promise<GiftBonus> {
  const row = await db.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  if (!row) return defaultGiftBonus;
  const parsed = giftBonusSchema.safeParse(JSON.parse(row.value));
  return parsed.success ? parsed.data : defaultGiftBonus;
}

export async function saveGiftBonus(b: GiftBonus) {
  const value = JSON.stringify(giftBonusSchema.parse(b));
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}
