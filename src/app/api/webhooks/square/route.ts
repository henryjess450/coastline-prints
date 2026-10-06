import { NextResponse } from "next/server";
import { SquareError, WebhooksHelper } from "square";
import { logError } from "@/lib/api";
import { finalizeGiftPurchase, GIFT_REF_PREFIX } from "@/lib/giftcards/server";
import { finalizeCheckout, paymentFacts, PaymentMismatchError } from "@/lib/orders/finalize";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { getSquare } from "@/lib/square/client";

export const runtime = "nodejs";

/**
 * Backup source of truth for payments. If the browser closes before the
 * checkout response arrives, this still creates the order (or, for a gift
 * card purchase, the card and its emails). Safe to receive
 * the same event many times: finalizeCheckout is idempotent.
 */
export async function POST(req: Request) {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!signatureKey) return new NextResponse("Webhook not configured", { status: 503 });

  const body = await req.text();
  const notificationUrl = process.env.SQUARE_WEBHOOK_URL ?? `${process.env.APP_URL ?? ""}/api/webhooks/square`;
  const valid = await WebhooksHelper.verifySignature({
    requestBody: body,
    signatureHeader: req.headers.get("x-square-hmacsha256-signature") ?? "",
    signatureKey,
    notificationUrl,
  });
  if (!valid) return new NextResponse("Invalid signature", { status: 401 });

  let event: { type?: string; data?: { id?: string } };
  try {
    event = JSON.parse(body);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  if (event.type !== "payment.updated" && event.type !== "payment.created") return NextResponse.json({ ignored: true });

  const paymentId = event.data?.id;
  if (!paymentId) return NextResponse.json({ ignored: true });

  try {
    // Fetch the payment from Square rather than trusting the event payload's shape.
    const { payment } = await getSquare().payments.get({ paymentId });
    if (!payment?.referenceId || payment.status !== "COMPLETED") return NextResponse.json({ ok: true });
    const ref = payment.referenceId;
    const result = ref.startsWith(GIFT_REF_PREFIX)
      ? await finalizeGiftPurchase(ref.slice(GIFT_REF_PREFIX.length), paymentFacts(payment))
      : await finalizeCheckout(ref, paymentFacts(payment));
    if (result?.created) sendNotificationsSoon("after-webhook");
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Square's "Send test event" uses a made-up payment id.
    if (err instanceof SquareError && err.statusCode === 404) return NextResponse.json({ ignored: "unknown payment" });
    if (err instanceof PaymentMismatchError) {
      logError("webhook:mismatch", err);
      return NextResponse.json({ ok: false }); // don't make Square retry a permanent problem
    }
    logError("webhook", err);
    return new NextResponse("Retry later", { status: 500 }); // Square will redeliver
  }
}
