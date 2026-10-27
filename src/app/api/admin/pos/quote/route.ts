import { NextResponse } from "next/server";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError, logError } from "@/lib/api";
import { pricePos, publicQuote } from "@/lib/pos/price.server";
import { posCartSchema } from "@/lib/pos/types";

export const runtime = "nodejs";

/** The register's running total, priced on the server. */
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const parsed = posCartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Bad cart.");
  try {
    return NextResponse.json(publicQuote(await pricePos(parsed.data)));
  } catch (err) {
    logError("pos:quote", err);
    return apiError(500, "Couldn't price the cart.");
  }
}
