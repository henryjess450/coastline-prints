import { NextResponse } from "next/server";
import { apiError, logError } from "@/lib/api";
import { cartSchema } from "@/lib/pricing/cart-schema";
import { CartError, priceCart } from "@/lib/pricing/server-quote";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Server-side price check for the cart. The checkout route uses the same priceCart(). */
export async function POST(req: Request) {
  const limit = rateLimit(`quote:${clientIp(req)}`, 120, 60_000);
  if (!limit.ok) return apiError(429, "Too many requests. Please slow down.", { retryAfter: limit.retryAfterS });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid request.");
  }
  const parsed = cartSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "Invalid cart.");

  try {
    const { config, ...quote } = await priceCart(parsed.data.items);
    void config;
    return NextResponse.json({ quote });
  } catch (err) {
    if (err instanceof CartError) return apiError(422, err.message);
    logError("quote", err);
    return apiError(500, "We couldn't price your order right now. Please try again.");
  }
}
