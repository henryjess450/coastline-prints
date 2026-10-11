import "server-only";
import { render, toPlainText } from "@react-email/render";
import { privateSite } from "@config/private.server";
import { legal, reviews } from "@config/site";
import type { Order, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { OutgoingEmail } from "@/lib/email/transport";
import { isLightLabOrder } from "@/lib/shop/brand";
import { ReviewRequest } from "@/emails/ReviewRequest";

/**
 * Queues the review email to go out a day after an order is picked up or
 * delivered. Once per customer, ever (the dedupe key is their email), and
 * never for LightLab shop orders. Runs inside the status-change transaction.
 */
export async function queueReviewRequest(tx: Prisma.TransactionClient, order: Order, now = new Date()) {
  if (!reviews.googleUrl) return;
  const dedupeKey = `review-request:${order.customerEmail.toLowerCase()}`;
  if (await tx.outboxJob.findUnique({ where: { dedupeKey } })) return;
  const items = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { productId: true } });
  if (isLightLabOrder(items)) return;
  await tx.outboxJob.create({
    data: {
      kind: "email",
      template: "review-request",
      payload: JSON.stringify({ orderId: order.id }),
      dedupeKey,
      nextAttemptAt: new Date(now.getTime() + reviews.delayHours * 3_600_000),
    },
  });
}

/**
 * The email itself, or null to skip it: the link was removed, the order was
 * moved back from picked up, or they've said no to emails from us.
 */
export async function buildReviewEmail(orderId: string): Promise<OutgoingEmail | null> {
  if (!reviews.googleUrl) return null;
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PICKED_UP") return null;
  const account = await db.customer.findUnique({ where: { email: order.customerEmail.toLowerCase() }, select: { emailOptOut: true } });
  if (account?.emailOptOut) return null;

  const html = await render(
    <ReviewRequest
      firstName={order.customerName.trim().split(/\s+/)[0] || "there"}
      orderNumber={order.orderNumber}
      shipped={order.fulfillment === "SHIP"}
      reviewUrl={reviews.googleUrl}
      problemDays={legal.problemReportDays}
    />,
  );
  return { to: order.customerEmail, replyTo: privateSite.ownerEmail, subject: "How did your print turn out?", html, text: toPlainText(html) };
}
