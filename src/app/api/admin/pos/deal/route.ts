import { NextResponse } from "next/server";
import { z } from "zod";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { shopToday } from "@/lib/shop/markets.server";

export const runtime = "nodejs";

/** Today's deal on one lamp at the stand: dollars off each, for today only. `offCents: null` ends it. */
const body = z.object({ productId: z.string().min(1).max(40), offCents: z.number().int().min(1).max(1_000_000).nullable() });

export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Pick a lamp and an amount.");
  const { productId, offCents } = parsed.data;
  const p = await db.shopProduct.findUnique({ where: { id: productId }, select: { priceCents: true } });
  if (!p) return apiError(404, "That lamp is gone.");
  if (offCents != null && offCents >= p.priceCents) return apiError(400, "The deal has to leave something to pay.");
  await db.shopProduct.update({ where: { id: productId }, data: offCents == null ? { standDealCents: null, standDealDate: null } : { standDealCents: offCents, standDealDate: shopToday() } });
  return NextResponse.json({ ok: true });
}
