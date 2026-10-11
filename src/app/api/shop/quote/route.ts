import { NextResponse } from "next/server";
import { apiError, logError } from "@/lib/api";
import { CartError } from "@/lib/pricing/server-quote";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { priceShopCart } from "@/lib/shop/price.server";
import { shopCartSchema } from "@/lib/shop/schema";

export const runtime = "nodejs";

/** Server price for a LightLab cart. Checkout uses the same priceShopCart(). */
export async function POST(req: Request) {
  const limit = rateLimit(`shop-quote:${clientIp(req)}`, 120, 60_000);
  if (!limit.ok) return apiError(429, "Too many requests. Please slow down.", { retryAfter: limit.retryAfterS });
  const parsed = shopCartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Invalid cart.");
  try {
    const { config, shopLines, lines, ...quote } = await priceShopCart(parsed.data.products);
    void config;
    void lines;
    return NextResponse.json({ quote, lines: shopLines });
  } catch (err) {
    if (err instanceof CartError) return apiError(422, err.message);
    logError("shop-quote", err);
    return apiError(500, "We couldn't price your cart right now. Please try again.");
  }
}
