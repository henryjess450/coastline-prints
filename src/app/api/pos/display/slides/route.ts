import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { DISPLAY_COOKIE, displayByToken } from "@/lib/pos/register.server";
import { loadDisplaySlides } from "@/lib/pos/slides.server";

export const runtime = "nodejs";

/** What the paired customer display shows between sales: lamps, where to find the stand next, and links to scan. */
export async function GET() {
  const r = await displayByToken((await cookies()).get(DISPLAY_COOKIE)?.value);
  if (!r?.pairedAt) return apiError(404, "Not set up.");
  return NextResponse.json(await loadDisplaySlides(), { headers: { "Cache-Control": "no-store" } });
}
