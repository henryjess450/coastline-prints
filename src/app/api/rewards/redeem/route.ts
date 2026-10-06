import { NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/account/auth";
import { apiError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { RedeemError, redeemPrize } from "@/lib/rewards/server";

export const runtime = "nodejs";

/** Trades the signed-in customer's points for a prize. */
export async function POST(req: Request) {
  const customer = await customerFromRequest(req);
  if (!customer) return apiError(401, "Please sign in first.");
  if (!rateLimit(`rewards:${clientIp(req)}`, 20, 10 * 60_000).ok) return apiError(429, "Too many tries. Please wait a few minutes.");
  const parsed = z.object({ prizeId: z.string().max(40) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Pick a prize.");
  try {
    return NextResponse.json({ ok: true, result: await redeemPrize(customer, parsed.data.prizeId) });
  } catch (err) {
    if (err instanceof RedeemError) return apiError(400, err.message);
    throw err;
  }
}
