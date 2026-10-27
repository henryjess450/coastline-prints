import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { createDisplay, DISPLAY_COOKIE, DISPLAY_COOKIE_DAYS, displayByToken, displayState } from "@/lib/pos/register.server";

export const runtime = "nodejs";

/** The customer display polls this: its pair code until paired, then what to show. 404 = start over with POST. */
export async function GET() {
  const r = await displayByToken((await cookies()).get(DISPLAY_COOKIE)?.value);
  if (!r) return apiError(404, "Not set up.");
  return NextResponse.json(displayState(r), { headers: { "Cache-Control": "no-store" } });
}

/** A tablet opening /pos for the first time: make it a display with a pair code. */
export async function POST(req: Request) {
  const jar = await cookies();
  const existing = await displayByToken(jar.get(DISPLAY_COOKIE)?.value);
  if (existing) return NextResponse.json(displayState(existing));
  const limit = rateLimit(`pos-display:${clientIp(req)}`, 10, 10 * 60_000);
  if (!limit.ok) return apiError(429, "Too many tries. Wait a few minutes.");
  const r = await createDisplay();
  jar.set(DISPLAY_COOKIE, r.displayToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DISPLAY_COOKIE_DAYS * 86_400 });
  return NextResponse.json(displayState(r));
}
