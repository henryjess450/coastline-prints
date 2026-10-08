import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, logError } from "@/lib/api";
import { normalizePostal } from "@/lib/checkout/schema";
import { cartSchema } from "@/lib/pricing/cart-schema";
import { CartError, priceCart } from "@/lib/pricing/server-quote";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { liveParcelOption } from "@/lib/shipping/canada-post";

export const runtime = "nodejs";

const bodySchema = cartSchema.extend({
  postal: z.string().transform(normalizePostal).pipe(z.string().regex(/^[A-Z]\d[A-Z] \d[A-Z]\d$/)),
});

/**
 * The bubble-mailer-as-parcel price to one postal code. Only this option
 * depends on the destination; the rest of shipping comes with the quote.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`ship-rates:${clientIp(req)}`, 30, 60_000);
  if (!limit.ok) return apiError(429, "Too many requests. Please slow down.", { retryAfter: limit.retryAfterS });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid request.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiError(400, "Invalid cart or postal code.");

  try {
    const priced = await priceCart(parsed.data.items);
    const parcel = priced.ok && priced.shipping?.ok ? priced.shipping.parcel : null;
    return NextResponse.json({ option: await liveParcelOption(parcel, parsed.data.postal) });
  } catch (err) {
    if (err instanceof CartError) return apiError(422, err.message);
    logError("ship-rates", err);
    return apiError(500, "Couldn't get shipping rates.");
  }
}
