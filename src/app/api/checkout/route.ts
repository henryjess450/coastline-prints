import { NextResponse } from "next/server";
import { pickup as pickupConfig } from "@config/pickup";
import { SquareError } from "square";
import { customerFromRequest } from "@/lib/account/auth";
import { apiError, logError } from "@/lib/api";
import { checkoutRequestSchema } from "@/lib/checkout/schema";
import { applyCodes } from "@/lib/codes/apply";
import { CodeError, lookupCodes, releaseCodes, reserveCodes, toCodeInfo } from "@/lib/codes/server";
import { db } from "@/lib/db";
import { finalizeCheckout, paymentFacts, type CartSnapshot } from "@/lib/orders/finalize";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { CartError, priceCart } from "@/lib/pricing/server-quote";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { isValidPickup } from "@/lib/pickup";
import { friendlyPaymentError, GENERIC_PAYMENT_ERROR } from "@/lib/square/errors";
import { getSquare, squareLocationId, squarePublicConfig } from "@/lib/square/client";
import { findOrCreateWithTimeout } from "@/lib/square/customers";

export const runtime = "nodejs";

/**
 * Pay-then-create flow:
 * 1. Re-validate and re-price the cart on the server.
 * 2. Save a PENDING checkout with that server price.
 * 3. Charge the card token with Square (idempotency key = the browser's attempt id).
 * 4. Only if Square reports COMPLETED, create the order.
 *
 * Coupons and gift cards are applied on the server and held during payment.
 * If gift cards cover everything, no card is charged at all.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`checkout:${clientIp(req)}`, 12, 10 * 60_000);
  if (!limit.ok) return apiError(429, "Too many payment attempts. Please wait a few minutes and try again.", { retryAfter: limit.retryAfterS });

  if (!squarePublicConfig()) return apiError(503, "Online payments aren't set up yet. Please try again later.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid request.");
  }
  const parsed = checkoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError(400, first?.path[0] === "customer" ? first.message : "Some order details are missing or invalid.");
  }
  const { attemptId, sourceId, customer, items, expectedTotalCents, pickup, codes } = parsed.data;

  // A retry of the same attempt (e.g. the response was lost on a bad connection).
  const previous = await db.checkout.findUnique({ where: { idempotencyKey: attemptId }, include: { order: true } });
  if (previous?.order) return success(previous.order);
  if (previous?.status === "FAILED") return apiError(409, "This payment attempt already failed. Please try again.");

  if (!previous && !isValidPickup(pickup.date, pickup.time, pickupConfig)) {
    return apiError(400, "That pickup time is no longer available. Please choose another.", { code: "PICKUP_UNAVAILABLE" });
  }

  let checkoutId = previous?.id;
  let totalCents = previous?.totalCents;
  let squareCustomerId = previous?.squareCustomerId ?? null;

  if (!previous) {
    let priced;
    try {
      priced = await priceCart(items);
    } catch (err) {
      if (err instanceof CartError) return apiError(422, err.message);
      logError("checkout:price", err);
      return apiError(500, "We couldn't price your order. Your card was not charged.");
    }
    if (!priced.ok) {
      const bad = priced.items.find((i) => !i.ok);
      return apiError(422, bad && !bad.ok ? bad.error : "One of your items can't be printed.");
    }
    // Codes saved to an account only work when signed in to it.
    const account = codes.length ? await customerFromRequest(req) : null;
    const { records, errors } = await lookupCodes(codes, new Date(), account?.id ?? null);
    if (errors.length) return apiError(409, `${errors[0].code}: ${errors[0].reason}`, { code: "CODE_INVALID", badCode: errors[0].code });
    const discount = applyCodes(priced.totalCents, records.map(toCodeInfo));
    if (discount.rejected.length) return apiError(409, `${discount.rejected[0].code}: ${discount.rejected[0].reason}`, { code: "CODE_INVALID", badCode: discount.rejected[0].code });

    if (discount.totalCents !== expectedTotalCents) {
      return apiError(409, "The price changed while you were checking out. Please review the new total.", { code: "PRICE_CHANGED", totalCents: discount.totalCents });
    }
    if (discount.totalCents > 0 && !sourceId) return apiError(400, "Please enter your card details.");

    // Save them to Square's customer list (never holds up the sale for more than a few seconds).
    squareCustomerId = await findOrCreateWithTimeout(customer);

    const snapshot: CartSnapshot = {
      lines: priced.lines,
      quote: { items: priced.items, baseFeeCents: priced.baseFeeCents, subtotalCents: priced.subtotalCents, minimumAdjCents: priced.minimumAdjCents, totalCents: priced.totalCents },
    };
    const checkout = await db.checkout.create({
      data: {
        idempotencyKey: attemptId,
        cart: JSON.stringify(snapshot),
        totalCents: discount.totalCents,
        discountCents: discount.discountCents,
        giftCardCents: discount.giftCardCents,
        appliedCodes: JSON.stringify(discount.applied),
        squareCustomerId,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        notes: customer.notes || null,
        pickupDate: pickup.date,
        pickupTime: pickup.time,
      },
    });
    checkoutId = checkout.id;
    totalCents = discount.totalCents;
    try {
      await reserveCodes(checkout.id, discount.applied, records);
    } catch (err) {
      await markFailed(checkout.id, "code reservation failed");
      if (err instanceof CodeError) return apiError(409, err.message, { code: "CODE_INVALID" });
      throw err;
    }
  }

  // Fully covered by gift cards: nothing to charge.
  if (totalCents === 0) {
    const result = await finalizeCheckout(checkoutId!, { id: `nopay_${checkoutId}`, status: "COMPLETED", amountCents: 0, currency: "CAD" });
    if (result?.created) sendNotificationsSoon("after-checkout");
    return result ? success(result.order) : apiError(500, "We couldn't place your order. Please try again.");
  }

  try {
    const { payment } = await getSquare().payments.create({
      sourceId,
      idempotencyKey: attemptId,
      amountMoney: { amount: BigInt(totalCents!), currency: "CAD" },
      locationId: squareLocationId(),
      autocomplete: true,
      referenceId: checkoutId,
      buyerEmailAddress: customer.email,
      customerId: squareCustomerId ?? undefined,
      note: `Coastline Prints checkout ${checkoutId}`,
    });
    if (!payment) throw new Error("Square returned no payment");
    const facts = paymentFacts(payment);

    if (facts.status === "COMPLETED") {
      const result = await finalizeCheckout(checkoutId!, facts);
      if (result) {
        // Send the receipt and owner email right after responding (the queue retries if this fails).
        if (result.created) sendNotificationsSoon("after-checkout");
        return success(result.order);
      }
    }
    if (facts.status === "APPROVED" || facts.status === "PENDING") {
      await db.checkout.update({ where: { id: checkoutId }, data: { squarePaymentId: facts.id } });
      return NextResponse.json({ status: "processing", attemptId }, { status: 202 });
    }
    await markFailed(checkoutId!, `status ${facts.status}`);
    return apiError(402, GENERIC_PAYMENT_ERROR);
  } catch (err) {
    if (err instanceof SquareError) {
      const codes = err.errors.map((e) => String(e.code));
      await markFailed(checkoutId!, codes.join(",") || err.message);
      // Declines are expected; only log unexpected API errors.
      if (err.statusCode !== 402 && err.statusCode !== 400) logError("checkout:square", err);
      return apiError(402, friendlyPaymentError(codes));
    }
    // Network/timeout: we don't know if Square charged the card. Leave the
    // checkout PENDING. Retrying with the same attempt id is safe.
    logError("checkout:charge", err);
    return apiError(503, "We couldn't confirm your payment. Please try again; you won't be charged twice.", { retryable: true });
  }
}

function success(order: { orderNumber: string; viewToken: string }) {
  return NextResponse.json({ status: "paid", orderNumber: order.orderNumber, viewToken: order.viewToken });
}

async function markFailed(checkoutId: string, reason: string) {
  await db.checkout.update({ where: { id: checkoutId }, data: { status: "FAILED", failureReason: reason.slice(0, 500) } }).catch((e) => logError("checkout:markFailed", e));
  // Give back any gift card balance or coupon use held for this attempt.
  await releaseCodes(checkoutId);
}
