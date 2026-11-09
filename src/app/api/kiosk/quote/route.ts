import { NextResponse } from "next/server";
import { apiError, logError } from "@/lib/api";
import { kioskCartSchema, pairedKiosk, quoteKioskCart } from "@/lib/kiosk/server";

export const runtime = "nodejs";

/** The kiosk cart's total (and any coupon), priced on the server. */
export async function POST(req: Request) {
  const kiosk = await pairedKiosk();
  if (!kiosk) return apiError(401, "This kiosk isn't paired.");
  const parsed = kioskCartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Bad cart.");
  try {
    return NextResponse.json(await quoteKioskCart(parsed.data, kiosk.mode === "order"));
  } catch (err) {
    logError("kiosk:quote", err);
    return apiError(500, "Couldn't price the cart.");
  }
}
