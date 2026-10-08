import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { suggestAddresses } from "@/lib/shipping/address-suggest";

export const runtime = "nodejs";

/** Canadian address suggestions for the street address box at checkout. */
export async function GET(req: Request) {
  const limit = rateLimit(`address:${clientIp(req)}`, 60, 60_000);
  if (!limit.ok) return apiError(429, "Too many requests.", { retryAfter: limit.retryAfterS });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ suggestions: await suggestAddresses(q) });
}
