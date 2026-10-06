import { NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/account/auth";
import { apiError } from "@/lib/api";
import { lookupCodes, toCodeInfo } from "@/lib/codes/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const body = z.object({ code: z.string().trim().min(1).max(40), pin: z.string().trim().max(12).optional() });

/** Checks one coupon or gift card code for the checkout box. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`codes:${ip}`, 30, 10 * 60_000).ok) return apiError(429, "Too many tries. Please wait a few minutes.");

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Enter a code.");

  const { code, pin } = parsed.data;
  const account = await customerFromRequest(req);
  const { records, errors } = await lookupCodes([pin ? `${code}:${pin}` : code], new Date(), account?.id ?? null);
  if (errors.length) {
    // Wrong guesses are limited much harder, so gift card numbers can't be brute-forced.
    if (!rateLimit(`codes-miss:${ip}`, 8, 30 * 60_000).ok) return apiError(429, "Too many wrong codes. Please wait half an hour.");
    return apiError(404, errors[0].reason);
  }
  return NextResponse.json({ code: toCodeInfo(records[0]) });
}
