import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, logError } from "@/lib/api";
import { answerQuote, CommissionError, syncCommission } from "@/lib/commissions/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Where a request stands (checks a card payment with Square), for the page to poll while paying. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const c = await db.lampCommission.findUnique({ where: { token: (await ctx.params).token } });
  if (!c) return apiError(404, "Not found.");
  const now = await syncCommission(c);
  const order = now.orderId ? await db.order.findUnique({ where: { id: now.orderId }, select: { viewToken: true, orderNumber: true } }) : null;
  return NextResponse.json({ status: now.status, order }, { headers: { "Cache-Control": "no-store" } });
}

/** The customer's answer to the quote. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const parsed = z.object({ accept: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Invalid request.");
  try {
    await answerQuote((await ctx.params).token, parsed.data.accept);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CommissionError) return apiError(409, err.message);
    logError("commission:answer", err);
    return apiError(500, "Couldn't save that. Please try again.");
  }
}
