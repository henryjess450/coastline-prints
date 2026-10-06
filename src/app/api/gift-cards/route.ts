import { NextResponse } from "next/server";
import { SquareError } from "square";
import { apiError, logError } from "@/lib/api";
import { db } from "@/lib/db";
import { deliverAtFor, giftRequestSchema, isValidSendOn } from "@/lib/giftcards/rules";
import { finalizeGiftPurchase, giftRef } from "@/lib/giftcards/server";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { paymentFacts } from "@/lib/orders/finalize";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { friendlyPaymentError, GENERIC_PAYMENT_ERROR } from "@/lib/square/errors";
import { getSquare, squareLocationId, squarePublicConfig } from "@/lib/square/client";

export const runtime = "nodejs";

/**
 * Buy a gift card. Same pay-then-create pattern as checkout:
 * 1. Validate and save a PENDING purchase.
 * 2. Charge the card token with Square (idempotency key = the browser's attempt id).
 * 3. Only once Square reports COMPLETED, create the card and queue the emails.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`gift:${clientIp(req)}`, 10, 10 * 60_000);
  if (!limit.ok) return apiError(429, "Too many payment attempts. Please wait a few minutes and try again.", { retryAfter: limit.retryAfterS });
  if (!squarePublicConfig()) return apiError(503, "Online payments aren't set up yet. Please try again later.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid request.");
  }
  const parsed = giftRequestSchema.safeParse(body);
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Some details are missing or invalid.");
  const d = parsed.data;

  // A retry of the same attempt (e.g. the response was lost on a bad connection).
  const previous = await db.giftPurchase.findUnique({ where: { idempotencyKey: d.attemptId } });
  if (previous?.status === "PAID") return success(previous);
  if (previous?.status === "FAILED") return apiError(409, "This payment attempt already failed. Please try again.");

  if (d.expectedTotalCents !== d.amountCents) return apiError(409, "The amount changed. Please check it and try again.");
  if (!previous && !isValidSendOn(d.sendOn)) return apiError(400, "Please choose a delivery date between tomorrow and a year from now.");

  const purchase =
    previous ??
    (await db.giftPurchase.create({
      data: {
        idempotencyKey: d.attemptId,
        amountCents: d.amountCents,
        buyerName: d.buyerName,
        buyerEmail: d.buyerEmail,
        recipientName: d.recipientName,
        recipientEmail: d.recipientEmail,
        message: d.message || null,
        sendOn: d.sendOn,
        deliverAt: deliverAtFor(d.sendOn),
      },
    }));

  try {
    const { payment } = await getSquare().payments.create({
      sourceId: d.sourceId,
      idempotencyKey: d.attemptId,
      amountMoney: { amount: BigInt(purchase.amountCents), currency: "CAD" },
      locationId: squareLocationId(),
      autocomplete: true,
      referenceId: giftRef(purchase.id),
      buyerEmailAddress: purchase.buyerEmail,
      note: `Coastline Prints gift card for ${purchase.recipientName}`.slice(0, 500),
    });
    if (!payment) throw new Error("Square returned no payment");
    const facts = paymentFacts(payment);

    if (facts.status === "COMPLETED") {
      const result = await finalizeGiftPurchase(purchase.id, facts);
      if (result) {
        if (result.created) sendNotificationsSoon("after-gift");
        return success(result.purchase);
      }
    }
    if (facts.status === "APPROVED" || facts.status === "PENDING") {
      await db.giftPurchase.update({ where: { id: purchase.id }, data: { squarePaymentId: facts.id } });
      return NextResponse.json({ status: "processing", attemptId: d.attemptId }, { status: 202 });
    }
    await markFailed(purchase.id, `status ${facts.status}`);
    return apiError(402, GENERIC_PAYMENT_ERROR);
  } catch (err) {
    if (err instanceof SquareError) {
      const codes = err.errors.map((e) => String(e.code));
      await markFailed(purchase.id, codes.join(",") || err.message);
      if (err.statusCode !== 402 && err.statusCode !== 400) logError("gift:square", err);
      return apiError(402, friendlyPaymentError(codes));
    }
    // Network/timeout: we don't know if Square charged the card. Retrying with the same attempt id is safe.
    logError("gift:charge", err);
    return apiError(503, "We couldn't confirm your payment. Please try again; you won't be charged twice.", { retryable: true });
  }
}

function success(p: { recipientName: string; sendOn: string | null }) {
  return NextResponse.json({ status: "paid", recipientName: p.recipientName, sendOn: p.sendOn });
}

async function markFailed(id: string, reason: string) {
  await db.giftPurchase.update({ where: { id }, data: { status: "FAILED", failureReason: reason.slice(0, 500) } }).catch((e) => logError("gift:markFailed", e));
}
