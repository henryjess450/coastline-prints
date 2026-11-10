import { NextResponse } from "next/server";
import { getCardFee } from "@/lib/pos/card-fee.server";

export const runtime = "nodejs";

/** The card processing fee settings, so pay screens can ask whether to cover it. */
export async function GET() {
  return NextResponse.json(await getCardFee(), { headers: { "Cache-Control": "no-store" } });
}
