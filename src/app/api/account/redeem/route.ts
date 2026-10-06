import { NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/account/auth";
import { SaveError, saveToWallet } from "@/lib/account/wallet";
import { apiError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const body = z.object({ code: z.string().trim().min(1).max(40), pin: z.string().trim().max(12).optional() });

/** Saves a gift card or one-use coupon to the signed-in account (and locks it to them). */
export async function POST(req: Request) {
  const customer = await customerFromRequest(req);
  if (!customer) return apiError(401, "Please sign in first.");
  const ip = clientIp(req);
  if (!rateLimit(`redeem:${ip}`, 20, 10 * 60_000).ok) return apiError(429, "Too many tries. Please wait a few minutes.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Enter the number on your card or coupon.");
  try {
    const item = await saveToWallet(customer.id, parsed.data.code, parsed.data.pin ?? "");
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    if (err instanceof SaveError) {
      // Wrong guesses are limited hard, so card numbers can't be brute-forced.
      if (!rateLimit(`redeem-miss:${ip}`, 8, 30 * 60_000).ok) return apiError(429, "Too many wrong numbers. Please wait half an hour.");
      return apiError(400, err.message);
    }
    throw err;
  }
}
