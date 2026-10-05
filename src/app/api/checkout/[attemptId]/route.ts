import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Polled by the browser when Square reports a payment as still processing. */
export async function GET(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const limit = rateLimit(`checkout-poll:${clientIp(req)}`, 120, 60_000);
  if (!limit.ok) return apiError(429, "Too many requests.");
  const { attemptId } = await ctx.params;
  const checkout = await db.checkout.findUnique({ where: { idempotencyKey: attemptId }, include: { order: true } });
  if (!checkout) return apiError(404, "Not found.");
  if (checkout.order) return NextResponse.json({ status: "paid", orderNumber: checkout.order.orderNumber, viewToken: checkout.order.viewToken });
  if (checkout.status === "FAILED") return NextResponse.json({ status: "failed" });
  return NextResponse.json({ status: "processing" });
}
