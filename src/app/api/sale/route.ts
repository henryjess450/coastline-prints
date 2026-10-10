import { NextResponse } from "next/server";
import { liveSale } from "@/lib/sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The site-wide sale on right now, so checkout can show it (the server applies it again when charging). */
export async function GET() {
  const s = await liveSale();
  return NextResponse.json({ sale: s ? { name: s.name, percentOff: s.percentOff, endsAt: s.endsAt.toISOString() } : null });
}
