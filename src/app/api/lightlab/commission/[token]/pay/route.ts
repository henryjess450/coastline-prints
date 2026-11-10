import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, logError } from "@/lib/api";
import { CommissionError, commissionPayLink } from "@/lib/commissions/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Paying an accepted quote by card: a Square link (with the card fee if they chose to cover it). */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const limit = rateLimit(`commission-pay:${clientIp(req)}`, 20, 10 * 60_000);
  if (!limit.ok) return apiError(429, "Too many tries. Please wait a few minutes.");
  const parsed = z.object({ coverFee: z.boolean().default(false) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Invalid request.");
  try {
    return NextResponse.json({ url: await commissionPayLink((await ctx.params).token, parsed.data.coverFee) });
  } catch (err) {
    if (err instanceof CommissionError) return apiError(409, err.message);
    logError("commission:pay", err);
    return apiError(500, "Couldn't set up the card payment. Please try again, or pay by e-Transfer.");
  }
}
