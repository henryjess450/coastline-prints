import { NextResponse } from "next/server";
import { z } from "zod";
import { LoginError, normalizeEmail, startSession, verifyLoginCode } from "@/lib/account/auth";
import { apiError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const body = z.object({ email: z.string().trim().email().max(200), code: z.string().trim().min(6).max(12) });

/** Checks the emailed code and signs the browser in. */
export async function POST(req: Request) {
  if (!rateLimit(`verify:${clientIp(req)}`, 20, 15 * 60_000).ok) return apiError(429, "Too many tries. Please wait a few minutes.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Enter the 6-digit code from your email.");
  try {
    const customer = await verifyLoginCode(normalizeEmail(parsed.data.email), parsed.data.code);
    await startSession(customer.id);
    return NextResponse.json({ ok: true, email: customer.email });
  } catch (err) {
    if (err instanceof LoginError) return apiError(401, err.message);
    throw err;
  }
}
