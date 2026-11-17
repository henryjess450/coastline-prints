import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { bridgeKeyOk } from "@/lib/receipt/bridge";
import { getStandWifi, standWifiFetched } from "@/lib/receipt/stand-wifi";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** The stand PC's Wi-Fi list (Admin > Receipts), for stand-wifi-sync.mjs. Needs the bridge key. */
export async function GET(req: Request) {
  if (!rateLimit(`print-bridge-wifi:${clientIp(req)}`, 10, 60_000).ok) return apiError(429, "Too many requests.");
  if (!(await bridgeKeyOk(req.headers.get("authorization")))) return apiError(401, "Unknown bridge key.");
  standWifiFetched();
  return NextResponse.json({ networks: await getStandWifi() }, { headers: { "Cache-Control": "no-store" } });
}
