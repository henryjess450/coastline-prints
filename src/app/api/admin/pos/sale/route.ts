import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError, logError } from "@/lib/api";
import { PosSaleError, ringUpSale } from "@/lib/pos/sale.server";

export const runtime = "nodejs";

/** Rings up the sale: creates the order. Payment was taken at the counter. */
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  try {
    const { order, emailed, changeCents } = await ringUpSale(await req.json().catch(() => null));
    return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber, emailed, changeCents: changeCents ?? null });
  } catch (err) {
    // A retry error means it's mid-save elsewhere: 503 so the offline queue sends it again later instead of parking it.
    if (err instanceof PosSaleError) return apiError(err.retry ? 503 : 409, err.message, { quote: err.quote });
    if (err instanceof ZodError) return apiError(400, err.issues[0]?.message ?? "Some details are missing.");
    logError("pos:sale", err);
    return apiError(500, "Couldn't ring up the sale.");
  }
}
