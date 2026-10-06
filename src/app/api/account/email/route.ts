import { NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest, LoginError } from "@/lib/account/auth";
import { sendLoginCode } from "@/lib/account/login-email";
import { startEmailChange } from "@/lib/account/profile";
import { apiError, logError } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const body = z.object({ email: z.string().trim().email("Please enter a valid email address.").max(200) });

/** Emails a code to the new address, to prove it's theirs before the account moves. */
export async function POST(req: Request) {
  const customer = await customerFromRequest(req);
  if (!customer) return apiError(401, "Please sign in again.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Please enter your new email.");
  if (!rateLimit(`email-change:${customer.id}`, 4, 15 * 60_000).ok) return apiError(429, "Too many codes asked for. Please wait a few minutes and try again.");
  try {
    const { email, code } = await startEmailChange(customer, parsed.data.email);
    await sendLoginCode(email, code, { change: true });
    return NextResponse.json({ ok: true, email });
  } catch (err) {
    if (err instanceof LoginError) return apiError(409, err.message);
    logError("account:email-change", err);
    return apiError(503, "We couldn't send the code just now. Please try again in a minute.");
  }
}
