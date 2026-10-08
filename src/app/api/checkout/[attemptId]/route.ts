import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { checkInbox, etransferSettings } from "@/lib/payments/etransfer.server";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Polled by the browser while a payment is still processing: a slow Square
 * payment, or an e-Transfer we're waiting to see in the inbox.
 */
export async function GET(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const limit = rateLimit(`checkout-poll:${clientIp(req)}`, 120, 60_000);
  if (!limit.ok) return apiError(429, "Too many requests.");
  const { attemptId } = await ctx.params;
  let checkout = await db.checkout.findUnique({ where: { idempotencyKey: attemptId }, include: { order: true } });
  if (!checkout) return apiError(404, "Not found.");
  if (checkout.paymentMethod === "ETRANSFER" && checkout.status === "PENDING" && !checkout.order) {
    // Someone is watching: look for their deposit now (throttled across everyone).
    await checkInbox({ minGapMs: 20_000 });
    checkout = (await db.checkout.findUnique({ where: { idempotencyKey: attemptId }, include: { order: true } }))!;
  }
  if (checkout.order) return NextResponse.json({ status: "paid", orderNumber: checkout.order.orderNumber, viewToken: checkout.order.viewToken });
  if (checkout.status === "FAILED") return NextResponse.json({ status: checkout.paymentMethod === "ETRANSFER" ? "expired" : "failed" });
  if (checkout.paymentMethod === "ETRANSFER") {
    return NextResponse.json({ status: "awaiting_etransfer", code: checkout.etransferCode, amountCents: checkout.totalCents, sendTo: etransferSettings()?.email ?? "", expiresAt: checkout.expiresAt?.toISOString() ?? null });
  }
  return NextResponse.json({ status: "processing" });
}
