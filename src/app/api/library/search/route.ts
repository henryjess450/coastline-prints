import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { configuredProviders, searchLibrary, searchLinks } from "@/lib/library/providers";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return apiError(400, "Type at least 2 characters.");
  const limit = rateLimit(`library:${clientIp(req)}`, 30, 60_000);
  if (!limit.ok) return apiError(429, "Too many searches. Please wait a moment.");
  const links = searchLinks(q);
  if (!configuredProviders().length) return NextResponse.json({ results: [], providers: [], links });
  return NextResponse.json({ ...(await searchLibrary(q)), links });
}
