"use client";
import { choiceIds, optionLabel, photosFor, type ShopProductDto } from "@/lib/shop/types";

/** One line in the kiosk's bag. Prices here are for show; the server prices the real total. */
export type KioskLine = { key: string; productId: string; variantId: string | null; /** Order kiosks: personalised text. */ customText: string; /** Picked choice ids of the product's option sets (cord colour...). */ choices: string[]; quantity: number; name: string; variantName: string | null; image: string | null; unitCents: number; max: number | null };

export const lineKey = (productId: string, variantId: string | null, customText = "", choices: string[] = []) => `${productId}:${variantId ?? ""}:${customText}${choices.length ? `|${choices.join(",")}` : ""}`;

export function addLine(lines: KioskLine[], p: ShopProductDto, variantId: string | null, quantity: number, unitCents: number, max: number | null, customText = "", picked?: string[]): KioskLine[] {
  const choices = choiceIds(p, picked);
  const key = lineKey(p.id, variantId, customText, choices);
  const have = lines.find((l) => l.key === key);
  const cap = (q: number) => Math.max(1, Math.min(max ?? 20, 20, q));
  if (have) return lines.map((l) => (l.key === key ? { ...l, quantity: cap(l.quantity + quantity) } : l));
  return [...lines, { key, productId: p.id, variantId, customText, choices, quantity: cap(quantity), name: p.name, variantName: optionLabel(p, variantId, choices), image: photosFor(p, variantId).images[0] ?? null, unitCents, max }];
}

export const toCart = (lines: KioskLine[], codes: string[], coverFee = false) => ({ products: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, customText: l.customText || null, ...(l.choices?.length ? { choices: l.choices } : {}) })), codes, coverFee });
