import { NextResponse } from "next/server";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError, logError } from "@/lib/api";
import type { AppliedCode } from "@/lib/codes/apply";
import { db } from "@/lib/db";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { finalizeCheckout, type CartSnapshot } from "@/lib/orders/finalize";
import { ADJUSTMENT_CODE, ADMIN_PAYMENT_PREFIX, manualOrderSchema } from "@/lib/orders/manual";
import { CartError, priceCart } from "@/lib/pricing/server-quote";
import { priceShopCart } from "@/lib/shop/price.server";

export const runtime = "nodejs";

/**
 * Creates an order typed in by the owner (admin only): prints from uploaded
 * files or shop products, priced by the server like a checkout, with where it
 * came from saved as the order's source. Payment happened elsewhere (cash,
 * e-Transfer, card in person) or hasn't yet, so nothing is charged here.
 */
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const parsed = manualOrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Some details are missing.");
  const { attemptId, source, customer, fulfillment, items, products, payment, priceCents, emailCustomer, printTicket } = parsed.data;

  // Pressed twice, or the response got lost: hand back the order already made.
  const previous = await db.checkout.findUnique({ where: { idempotencyKey: attemptId }, include: { order: true } });
  if (previous?.order) return NextResponse.json({ orderId: previous.order.id, orderNumber: previous.order.orderNumber });

  const shop = products.length > 0;
  let priced;
  try {
    priced = shop ? await priceShopCart(products) : await priceCart(items);
  } catch (err) {
    if (err instanceof CartError) return apiError(422, err.message);
    logError("admin:new-order:price", err);
    return apiError(500, "Couldn't price the order.");
  }
  if (!priced.ok) {
    const bad = priced.items.find((i) => !i.ok);
    return apiError(422, bad && !bad.ok ? bad.error : "One of the items can't be printed.");
  }

  // Charging less than the site price shows as a discount line on the receipt and invoice.
  if (priceCents != null && priceCents > priced.totalCents) return apiError(422, "The price can't be more than the site price. Add items or raise the quantity instead.");
  const discountCents = priceCents == null ? 0 : priced.totalCents - priceCents;
  const applied: AppliedCode[] = discountCents > 0 ? [{ code: ADJUSTMENT_CODE, kind: "SALE", label: "Price adjustment", amountCents: discountCents }] : [];
  const shippingCents = fulfillment.method === "ship" ? fulfillment.shippingCents : 0;
  const totalCents = priced.totalCents - discountCents + shippingCents;

  const snapshot: CartSnapshot = {
    lines: priced.lines,
    shopLines: shop ? (priced as Awaited<ReturnType<typeof priceShopCart>>).shopLines : undefined,
    shop: shop ? (priced as Awaited<ReturnType<typeof priceShopCart>>).shop : undefined,
    quote: { items: priced.items, baseFeeCents: priced.baseFeeCents, subtotalCents: priced.subtotalCents, minimumAdjCents: priced.minimumAdjCents, totalCents: priced.totalCents, shipping: null },
  };

  try {
    const checkout =
      previous ??
      (await db.checkout.create({
        data: {
          idempotencyKey: attemptId,
          source,
          firstSource: source,
          sourceDetail: JSON.stringify({ manual: true, last: null, first: null }),
          cart: JSON.stringify(snapshot),
          totalCents,
          discountCents,
          appliedCodes: JSON.stringify(applied),
          paymentMethod: payment,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          notes: customer.notes || null,
          ...(fulfillment.method === "pickup"
            ? { fulfillment: "PICKUP", pickupDate: fulfillment.date || null, pickupTime: fulfillment.date && fulfillment.time ? fulfillment.time : null }
            : {
                fulfillment: "SHIP",
                shippingCents,
                shippingBoxes: "[]",
                shipName: fulfillment.address.name,
                shipLine1: fulfillment.address.line1,
                shipLine2: fulfillment.address.line2 || null,
                shipCity: fulfillment.address.city,
                shipProvince: fulfillment.address.province,
                shipPostal: fulfillment.address.postal,
              }),
        },
      }));
    const result = await finalizeCheckout(
      checkout.id,
      { id: `${ADMIN_PAYMENT_PREFIX}${checkout.id}`, status: "COMPLETED", amountCents: checkout.totalCents, currency: checkout.currency },
      { note: `Added by you (${source})`, emailCustomer, printTicket },
    );
    if (!result) return apiError(500, "Couldn't save the order.");
    if (result.created) sendNotificationsSoon("admin-order");
    return NextResponse.json({ orderId: result.order.id, orderNumber: result.order.orderNumber });
  } catch (err) {
    logError("admin:new-order", err);
    return apiError(500, "Couldn't save the order.");
  }
}
