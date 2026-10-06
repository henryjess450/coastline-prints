import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { releaseSendOff } from "@/lib/notify/sendoff";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const body = z.union([z.object({ order: z.string().regex(/^[\w-]{20,64}$/) }), z.object({ gift: z.string().uuid() })]);

/**
 * Called by the browser when the send-off animation finishes: sends the
 * receipt, owner email and ticket for that order (or the gift card emails)
 * right away instead of waiting out the hold. Harmless to call twice.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`sendoff:${clientIp(req)}`, 30, 60_000);
  if (!limit.ok) return apiError(429, "Too many requests.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Invalid request.");

  const id =
    "order" in parsed.data
      ? (await db.order.findUnique({ where: { viewToken: parsed.data.order }, select: { id: true } }))?.id
      : (await db.giftPurchase.findUnique({ where: { idempotencyKey: parsed.data.gift }, select: { id: true, status: true } }))?.id;
  if (!id) return apiError(404, "Not found.");

  const released = await releaseSendOff(id);
  if (released) sendNotificationsSoon("after-sendoff");
  return NextResponse.json({ ok: true });
}
