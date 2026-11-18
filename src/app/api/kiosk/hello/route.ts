import { NextResponse } from "next/server";
import { apiError, logError } from "@/lib/api";
import { kioskForThisDevice } from "@/lib/kiosk/server";
import { orderMinDate } from "@/lib/pos/types";
import { squarePublicConfig } from "@/lib/square/client";
import { todaysClosings } from "@/lib/shop/markets.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The tablet saying hello: makes it a kiosk (with a pairing code) the first time, then says whether it's paired (and, once it is, how to load Square's card form). */
export async function POST() {
  try {
    const k = await kioskForThisDevice(true);
    return NextResponse.json({ paired: !!k?.pairedAt, pairCode: k?.pairedAt ? null : k?.pairCode, name: k?.name ?? "", mode: k?.mode === "order" ? "order" : "shop", minDate: orderMinDate(), square: k?.pairedAt ? squarePublicConfig() : null, closing: k?.pairedAt ? await todaysClosings() : [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logError("kiosk:hello", err);
    return apiError(500, "The kiosk couldn't start.");
  }
}
