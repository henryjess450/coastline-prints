import { NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest, LoginError } from "@/lib/account/auth";
import { finishEmailChange } from "@/lib/account/profile";
import { apiError } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const body = z.object({ email: z.string().trim().email().max(200), code: z.string().trim().min(6).max(12) });

/** Checks the code from the new address and moves the account (with its orders and points) to it. */
export async function POST(req: Request) {
  const customer = await customerFromRequest(req);
  if (!customer) return apiError(401, "Please sign in again.");
  if (!rateLimit(`email-confirm:${customer.id}`, 20, 15 * 60_000).ok) return apiError(429, "Too many tries. Please wait a few minutes.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Enter the 6-digit code from your email.");
  try {
    return NextResponse.json({ ok: true, email: await finishEmailChange(customer, parsed.data.email, parsed.data.code) });
  } catch (err) {
    if (err instanceof LoginError) return apiError(401, err.message);
    throw err;
  }
}
