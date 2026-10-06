import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Polled by the browser when Square reports a gift card payment as still processing. */
export async function GET(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const limit = rateLimit(`gift-poll:${clientIp(req)}`, 120, 60_000);
  if (!limit.ok) return apiError(429, "Too many requests.");
  const { attemptId } = await ctx.params;
  const p = await db.giftPurchase.findUnique({ where: { idempotencyKey: attemptId } });
  if (!p) return apiError(404, "Not found.");
  if (p.status === "PAID") return NextResponse.json({ status: "paid", recipientName: p.recipientName, sendOn: p.sendOn });
  if (p.status === "FAILED") return NextResponse.json({ status: "failed" });
  return NextResponse.json({ status: "processing" });
}
