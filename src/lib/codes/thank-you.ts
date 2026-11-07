import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { generateCode } from "./server";

/*
 * Printed thank-you cards for LightLab: a batch of one-use percent-off
 * coupons, each with its own QR code, printed 12 to a page. A coupon works
 * online (the QR opens the shop and adds it at checkout) and at the market
 * stand register (type the number or scan the QR).
 */

export type CardBatch = {
  id: string;
  heading: string;
  message: string;
  percent: number;
  /** Null = never expires. */
  expiresAt: string | null;
  createdAt: string;
};

const metaKey = (id: string) => `card-batch:${id}`;

export const CARD_DEFAULTS = { heading: "Thanks for shopping with us!", message: "Here's a little something for next time.", percent: 5 };

/** Makes `count` coupons and remembers the card's wording. Returns the batch id. */
export async function createCardBatch(input: { count: number; percent: number; days: number | null; heading: string; message: string }) {
  const id = randomBytes(4).toString("hex");
  const expiresAt = input.days ? new Date(Date.now() + input.days * 86_400_000) : null;
  const meta: CardBatch = { id, heading: input.heading, message: input.message, percent: input.percent, expiresAt: expiresAt?.toISOString() ?? null, createdAt: new Date().toISOString() };

  // Fresh numbers that nobody has, checked in one go.
  const codes = new Set<string>();
  while (codes.size < input.count) codes.add(generateCode("PERCENT"));
  const taken = new Set((await db.promoCode.findMany({ where: { code: { in: [...codes] } }, select: { code: true } })).map((r) => r.code));
  for (const c of taken) {
    codes.delete(c);
    let next = generateCode("PERCENT");
    while (codes.has(next) || taken.has(next)) next = generateCode("PERCENT");
    codes.add(next);
  }

  await db.$transaction([
    db.setting.create({ data: { key: metaKey(id), value: JSON.stringify(meta) } }),
    db.promoCode.createMany({
      data: [...codes].map((code) => ({ code, kind: "PERCENT", percentOff: input.percent, maxUses: 1, expiresAt, cardBatch: id, note: `LightLab thank-you card (batch ${id})` })),
    }),
  ]);
  return id;
}

export async function cardBatch(id: string): Promise<CardBatch | null> {
  const row = await db.setting.findUnique({ where: { key: metaKey(id) } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as CardBatch;
  } catch {
    return null;
  }
}

/** Every batch, newest first, with how many cards came back. */
export async function listCardBatches() {
  const rows = await db.setting.findMany({ where: { key: { startsWith: "card-batch:" } } });
  const batches = rows.flatMap((r) => {
    try {
      return [JSON.parse(r.value) as CardBatch];
    } catch {
      return [];
    }
  });
  const counts = await db.promoCode.groupBy({ by: ["cardBatch"], where: { cardBatch: { in: batches.map((b) => b.id) } }, _count: { _all: true } });
  const used = await db.promoCode.groupBy({ by: ["cardBatch"], where: { cardBatch: { in: batches.map((b) => b.id) }, uses: { gt: 0 } }, _count: { _all: true } });
  const n = (list: typeof counts, id: string) => list.find((c) => c.cardBatch === id)?._count._all ?? 0;
  return batches.map((b) => ({ ...b, count: n(counts, b.id), used: n(used, b.id) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function cardBatchCodes(id: string) {
  return (await db.promoCode.findMany({ where: { cardBatch: id }, select: { code: true, uses: true, active: true }, orderBy: { code: "asc" } })).map((r) => r.code);
}

/** The link in each card's QR code: opens the shop with the coupon ready for checkout. */
export function cardLink(code: string) {
  return `${(process.env.APP_URL ?? "https://coastlineprints.ca").replace(/\/$/, "")}/lightlab?code=${code}`;
}

/** Turn off a whole batch (lost or binned cards). */
export async function retireCardBatch(id: string) {
  return (await db.promoCode.updateMany({ where: { cardBatch: id, uses: 0 }, data: { active: false } })).count;
}
