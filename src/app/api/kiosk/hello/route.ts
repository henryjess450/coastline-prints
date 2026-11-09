import { NextResponse } from "next/server";
import { apiError, logError } from "@/lib/api";
import { kioskForThisDevice } from "@/lib/kiosk/server";
import { orderMinDate } from "@/lib/pos/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The tablet saying hello: makes it a kiosk (with a pairing code) the first time, then says whether it's paired. */
export async function POST() {
  try {
    const k = await kioskForThisDevice(true);
    return NextResponse.json({ paired: !!k?.pairedAt, pairCode: k?.pairedAt ? null : k?.pairCode, name: k?.name ?? "", mode: k?.mode === "order" ? "order" : "shop", minDate: orderMinDate() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logError("kiosk:hello", err);
    return apiError(500, "The kiosk couldn't start.");
  }
}
