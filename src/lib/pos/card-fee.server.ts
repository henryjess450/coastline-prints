import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { CARD_FEE_DEFAULTS, CARD_FEE_KEY, type CardFeeSettings } from "./card-fee";

const schema = z.object({ on: z.boolean(), percent: z.number().min(0).max(10), fixedCents: z.number().int().min(0).max(500) });

export async function getCardFee(): Promise<CardFeeSettings> {
  const row = await db.setting.findUnique({ where: { key: CARD_FEE_KEY } }).catch(() => null);
  try {
    return row ? { ...CARD_FEE_DEFAULTS, ...schema.parse(JSON.parse(row.value)) } : CARD_FEE_DEFAULTS;
  } catch {
    return CARD_FEE_DEFAULTS;
  }
}

export async function saveCardFee(input: unknown) {
  const value = JSON.stringify(schema.parse(input));
  await db.setting.upsert({ where: { key: CARD_FEE_KEY }, create: { key: CARD_FEE_KEY, value }, update: { value } });
}
