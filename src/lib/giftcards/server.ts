import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { logError } from "@/lib/api";
import { formatCardNumber } from "@/lib/codes/apply";
import { generateCode, generatePin } from "@/lib/codes/server";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { sendOffHold } from "@/lib/notify/sendoff";
import { PaymentMismatchError, type PaymentFacts } from "@/lib/orders/finalize";

/** Square reference ids for gift purchases start with this, so the webhook can tell them from orders. */
export const GIFT_REF_PREFIX = "gift_";
export const giftRef = (purchaseId: string) => `${GIFT_REF_PREFIX}${purchaseId}`;

/** Emails sent for a paid gift card. The recipient's waits until deliverAt. */
export const GIFT_EMAIL_TEMPLATES = ["gift-recipient", "gift-buyer", "gift-owner"] as const;
export type GiftEmailTemplate = (typeof GIFT_EMAIL_TEMPLATES)[number];

/**
 * Creates the gift card for a paid purchase, exactly once, and queues the
 * emails. Called from the purchase route and the Square webhook; safe to
 * call repeatedly with the same payment.
 */
export async function finalizeGiftPurchase(purchaseId: string, payment: PaymentFacts) {
  const purchase = await db.giftPurchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) return null;
  if (purchase.status === "PAID") return { purchase, created: false };
  if (payment.status !== "COMPLETED") return null;

  const expectedLocation = process.env.SQUARE_LOCATION_ID;
  if (payment.amountCents !== purchase.amountCents || payment.currency !== "CAD" || (expectedLocation && payment.locationId && payment.locationId !== expectedLocation)) {
    await db.giftPurchase.update({ where: { id: purchaseId }, data: { status: "FAILED", failureReason: `Payment ${payment.id} amount/currency/location mismatch` } });
    throw new PaymentMismatchError(`Payment ${payment.id} does not match gift purchase ${purchaseId}`);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const done = await db.$transaction(async (tx) => {
        // Claim the purchase first so a second finalize can't make a second card.
        const { count } = await tx.giftPurchase.updateMany({ where: { id: purchaseId, status: { not: "PAID" } }, data: { status: "PAID" } });
        if (count !== 1) return null;
        const code = await tx.promoCode.create({
          data: {
            code: generateCode("GIFT_CARD"),
            pin: generatePin(),
            kind: "GIFT_CARD",
            initialCents: purchase.amountCents,
            balanceCents: purchase.amountCents,
            note: `Bought online by ${purchase.buyerName} for ${purchase.recipientName}`.slice(0, 200),
          },
        });
        const updated = await tx.giftPurchase.update({
          where: { id: purchaseId },
          data: { codeId: code.id, squarePaymentId: payment.id, receiptUrl: payment.receiptUrl, cardBrand: payment.cardBrand, cardLast4: payment.last4, paidAt: new Date() },
        });
        const job = (template: GiftEmailTemplate, at: Date) => ({ kind: "email", template, payload: JSON.stringify({ giftId: purchaseId }), dedupeKey: `${purchaseId}:${template}`, nextAttemptAt: at });
        // Everything waits for the send-off animation; a scheduled gift keeps its later date.
        const held = sendOffHold();
        await tx.outboxJob.createMany({
          data: [job("gift-recipient", purchase.deliverAt > held ? purchase.deliverAt : held), job("gift-buyer", held), job("gift-owner", held)],
        });
        return updated;
      });
      if (done) return { purchase: done, created: true };
      const winner = await db.giftPurchase.findUnique({ where: { id: purchaseId } });
      return winner ? { purchase: winner, created: false } : null;
    } catch (err) {
      // A random card number collided with an existing one: try another.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  const err = new Error(`Could not allocate a gift card number for purchase ${purchaseId}`);
  logError("gift:finalize", err);
  throw err;
}

/** Everything the gift emails and the card image need. */
export async function loadGiftData(purchaseId: string) {
  const p = await db.giftPurchase.findUnique({ where: { id: purchaseId }, include: { code: true } });
  if (!p || !p.code) return null;
  return {
    id: p.id,
    amountCents: p.amountCents,
    amount: money(p.amountCents),
    buyerName: p.buyerName,
    buyerEmail: p.buyerEmail,
    recipientName: p.recipientName,
    recipientEmail: p.recipientEmail,
    message: p.message,
    sendOn: p.sendOn,
    deliverAt: p.deliverAt,
    number: formatCardNumber(p.code.code),
    pin: p.code.pin ?? "",
    receiptUrl: p.receiptUrl,
    card: p.cardLast4 ? `${p.cardBrand ?? "Card"} •••• ${p.cardLast4}` : null,
  };
}
export type GiftData = NonNullable<Awaited<ReturnType<typeof loadGiftData>>>;
