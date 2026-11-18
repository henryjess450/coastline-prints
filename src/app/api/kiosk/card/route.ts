import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, logError } from "@/lib/api";
import { normalizeCode } from "@/lib/codes/apply";
import { lookupCodes } from "@/lib/codes/server";
import { db } from "@/lib/db";
import { pairedKiosk } from "@/lib/kiosk/server";
import { rateLimit } from "@/lib/ratelimit";
import { maskEmail, rewardsRef } from "@/lib/rewards/stand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * A thank-you card (or a receipt's come-back coupon) held up to the kiosk's
 * camera or a scanner: who it was for, when we know, and its discount if it
 * still works. Cards are handed out blank, so a card nobody has used yet only
 * gives its discount; once it's been used, or when it's a receipt's coupon,
 * it belongs to that sale's customer and the kiosk can say hello by name.
 */

const body = z.object({ text: z.string().trim().min(4).max(500) });

/** The code from a card's QR link ("…/lightlab?code=1234…") or the number itself. */
const codeFrom = (text: string) => normalizeCode(text.match(/[?&]code=([A-Za-z0-9-]+)/)?.[1] ?? text.replace(/\s/g, ""));

export async function POST(req: Request) {
  const kiosk = await pairedKiosk();
  if (!kiosk) return apiError(401, "This kiosk isn't paired.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "That didn't scan. Try again.");
  if (!rateLimit(`kiosk-card:${kiosk.id}`, 12, 60_000).ok) return apiError(429, "Too many scans. Please wait a minute.");
  const code = codeFrom(parsed.data.text);
  try {
    const row = code ? await db.promoCode.findUnique({ where: { code }, select: { code: true, kind: true, comebackOrderId: true, rewardOrderId: true, owner: { select: { name: true, email: true } } } }) : null;
    if (!row || row.kind === "GIFT_CARD") return apiError(404, "We don't know that card. Ask us at the stand.");

    // Who it's for: the receipt it was printed on, the order it thanked, its saved account, or the last sale that used it.
    const orderId = row.comebackOrderId ?? row.rewardOrderId;
    const order = orderId ? await db.order.findUnique({ where: { id: orderId }, select: { customerName: true, customerEmail: true } }) : null;
    const used = !order && !row.owner ? await db.codeRedemption.findFirst({ where: { code: { code } }, orderBy: { createdAt: "desc" }, select: { checkout: { select: { customerName: true, customerEmail: true } } } }) : null;
    const who = order ? { name: order.customerName, email: order.customerEmail } : row.owner ? { name: row.owner.name ?? "", email: row.owner.email } : used ? { name: used.checkout.customerName, email: used.checkout.customerEmail } : null;
    const name = who && who.name !== "Walk-in customer" ? who.name.trim() : "";
    const email = who?.email?.trim().toLowerCase() ?? "";

    // Its discount, if it still works at the stand.
    const { records } = await lookupCodes([code], new Date(), null, email || null, { channel: "market" });
    return NextResponse.json({
      firstName: name.split(/\s+/)[0] ?? "",
      name,
      maskedEmail: email ? maskEmail(email) : null,
      ref: email ? rewardsRef(email) : null,
      code: records.length ? row.code : null,
    });
  } catch (err) {
    logError("kiosk:card", err);
    return apiError(502, "Couldn't check that card. Please try again.");
  }
}
