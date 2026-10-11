import { NextResponse } from "next/server";
import { z } from "zod";
import { lightlab } from "@config/lightlab";
import { apiError, logError } from "@/lib/api";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { toProductDto } from "@/lib/shop/products.server";
import { inStock, variantOf } from "@/lib/shop/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  productId: z.string().min(1).max(40),
  variantId: z.string().max(40).nullable().default(null),
  email: z.string().trim().toLowerCase().email().max(200),
});

/** "Tell me when it's back": saves an email to send when this sold-out product or option is restocked. */
export async function POST(req: Request) {
  const limit = rateLimit(`restock:${clientIp(req)}`, 10, 60 * 60_000);
  if (!limit.ok) return apiError(429, "Too many requests. Please try again later.", { retryAfter: limit.retryAfterS });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Please enter a valid email address.");
  const { productId, variantId, email } = parsed.data;
  try {
    const row = await db.shopProduct.findUnique({ where: { id: productId } });
    if (!row || row.shop !== lightlab.id || !row.active) return apiError(404, "That product isn't available any more.");
    const p = toProductDto(row);
    if (variantId && !variantOf(p, variantId)) return apiError(404, "That option isn't available any more.");
    if (inStock(p, variantId) !== 0) return apiError(409, "Good news: it's in stock right now.");
    // Asking twice is fine: one email either way.
    await db.restockRequest.upsert({
      where: { productId_variantId_email: { productId, variantId: variantId ?? "", email } },
      create: { productId, variantId: variantId ?? "", email },
      update: { notifiedAt: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("restock", err);
    return apiError(500, "Couldn't save that. Please try again.");
  }
}
