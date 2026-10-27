import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { DISPLAY_COOKIE, displayByToken, emailFromDisplay } from "@/lib/pos/register.server";

export const runtime = "nodejs";

const body = z.object({ email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(200)]) });

/** The customer typed their email on the display (or "" for no thanks). */
export async function POST(req: Request) {
  const limit = rateLimit(`pos-email:${clientIp(req)}`, 30, 10 * 60_000);
  if (!limit.ok) return apiError(429, "Too many tries.");
  const r = await displayByToken((await cookies()).get(DISPLAY_COOKIE)?.value);
  if (!r?.pairedAt) return apiError(404, "Not set up.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "That email doesn't look right.");
  if (!(await emailFromDisplay(r, parsed.data.email))) return apiError(409, "Not asking for an email right now.");
  return NextResponse.json({ ok: true });
}
