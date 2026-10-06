import { NextResponse } from "next/server";
import { z } from "zod";
import { createLoginCode, normalizeEmail } from "@/lib/account/auth";
import { sendLoginCode } from "@/lib/account/login-email";
import { apiError, logError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const body = z.object({ email: z.string().trim().email("Please enter a valid email address.").max(200) });

/** Emails a 6-digit sign-in code. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Please enter your email.");
  const email = normalizeEmail(parsed.data.email);
  if (!rateLimit(`login-ip:${clientIp(req)}`, 10, 15 * 60_000).ok || !rateLimit(`login-email:${email}`, 4, 15 * 60_000).ok) {
    return apiError(429, "Too many codes asked for. Please wait a few minutes and try again.");
  }
  try {
    await sendLoginCode(email, await createLoginCode(email));
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("account:code", err);
    return apiError(503, "We couldn't send the code just now. Please try again in a minute.");
  }
}
