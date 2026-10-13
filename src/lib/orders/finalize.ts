import "server-only";
import type { Square } from "square";
import { Prisma } from "@/generated/prisma/client";
import { logError } from "@/lib/api";
import { db } from "@/lib/db";
import { lampForSale } from "@/lib/lamp/server";
import { sendOffHold } from "@/lib/notify/sendoff";
import { creditInvite } from "@/lib/rewards/invite";
import type { ItemQuote, OrderQuote } from "@/lib/pricing/quote";
import type { PricedCart } from "@/lib/pricing/server-quote";
import type { ShippingOption } from "@/lib/shipping/pack";
import type { PricedShopLine } from "@/lib/shop/types";
import { shopConfig, type ShopId } from "@config/shops";
import { newOrderNumber, newViewToken } from "./number";

/** What we stored on the Checkout row before charging: the server-priced cart. */
export type CartSnapshot = {
  lines: PricedCart["lines"];
  /** Shop products (an order has prints or products, not both). */
  shopLines?: PricedShopLine[];
  /** Which shop the products are from. Missing on older LightLab checkouts. */
  shop?: ShopId;
  quote: Pick<OrderQuote, "items" | "baseFeeCents" | "subtotalCents" | "minimumAdjCents" | "totalCents"> & { shipping?: ShippingOption | null };
};

/** The payment fields we rely on, normalised from Square's Payment object. */
export type PaymentFacts = {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  locationId?: string;
  receiptUrl?: string;
  cardBrand?: string;
  last4?: string;
};

export function paymentFacts(p: Square.Payment): PaymentFacts {
  return {
    id: p.id ?? "",
    status: p.status ?? "",
    amountCents: Number(p.amountMoney?.amount ?? -1),
    currency: p.amountMoney?.currency ?? "",
    locationId: p.locationId,
    receiptUrl: p.receiptUrl,
    cardBrand: p.cardDetails?.card?.cardBrand,
    last4: p.cardDetails?.card?.last4,
  };
}

export class PaymentMismatchError extends Error {}

/**
 * Creates the Order for a paid checkout, exactly once.
 *
 * Called from both the checkout route (direct Square response) and the
 * webhook. The unique constraint on Order.checkoutId means two concurrent
 * calls can't both create an order: the loser gets the existing one back.
 */
export async function finalizeCheckout(checkoutId: string, payment: PaymentFacts) {
  const existing = await db.order.findUnique({ where: { checkoutId } });
  if (existing) return { order: existing, created: false };

  if (payment.status !== "COMPLETED") return null;

  // Unknown reference: a payment made elsewhere in the Square account. Ignore it.
  const checkout = await db.checkout.findUnique({ where: { id: checkoutId } });
  if (!checkout) return null;

  // Never trust that the charged amount matches the order: verify it.
  const expectedLocation = process.env.SQUARE_LOCATION_ID;
  if (
    payment.amountCents !== checkout.totalCents ||
    payment.currency !== checkout.currency ||
    (expectedLocation && payment.locationId && payment.locationId !== expectedLocation)
  ) {
    await db.checkout.update({ where: { id: checkoutId }, data: { status: "FAILED", failureReason: `Payment ${payment.id} amount/currency/location mismatch` } });
    throw new PaymentMismatchError(`Payment ${payment.id} does not match checkout ${checkoutId}`);
  }

  const cart = JSON.parse(checkout.cart) as CartSnapshot;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const order = await db.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            orderNumber: newOrderNumber(new Date(), cart.shopLines?.length ? shopConfig(cart.shop).orderPrefix : "CP"),
            viewToken: newViewToken(),
            checkoutId,
            status: "PAID",
            customerName: checkout.customerName,
            customerEmail: checkout.customerEmail,
            customerPhone: checkout.customerPhone,
            notes: checkout.notes,
            pickupDate: checkout.pickupDate,
            pickupTime: checkout.pickupTime,
            fulfillment: checkout.fulfillment,
            shippingCents: checkout.shippingCents,
            shippingBoxes: checkout.shippingBoxes,
            shipName: checkout.shipName,
            shipLine1: checkout.shipLine1,
            shipLine2: checkout.shipLine2,
            shipCity: checkout.shipCity,
            shipProvince: checkout.shipProvince,
            shipPostal: checkout.shipPostal,
            subtotalCents: cart.quote.subtotalCents,
            baseFeeCents: cart.quote.baseFeeCents,
            minimumAdjCents: cart.quote.minimumAdjCents,
            discountCents: checkout.discountCents,
            giftCardCents: checkout.giftCardCents,
            appliedCodes: checkout.appliedCodes,
            squareCustomerId: checkout.squareCustomerId,
            customerOrderCount: (await tx.order.count({ where: { customerEmail: checkout.customerEmail } })) + 1,
            source: checkout.source,
            firstSource: checkout.firstSource,
            sourceDetail: checkout.sourceDetail,
            totalCents: checkout.totalCents,
            currency: checkout.currency,
            squarePaymentId: payment.id,
            paymentMethod: checkout.paymentMethod,
            etransferDiscountCents: checkout.etransferDiscountCents,
            receiptUrl: payment.receiptUrl,
            cardBrand: payment.cardBrand,
            cardLast4: payment.last4,
            items: { create: [...cart.lines.map((line, i) => orderItemData(line, cart.quote.items[i])), ...(cart.shopLines ?? []).map((l) => shopItemData(l, cart.shop))] },
            events: { create: { fromStatus: null, toStatus: "PAID", note: "Payment completed" } },
          },
        });
        await tx.checkout.update({ where: { id: checkoutId }, data: { status: "COMPLETED", squarePaymentId: payment.id } });
        for (const line of cart.shopLines ?? []) await takeStock(tx, line, order.id, cart.shop);
        await tx.codeRedemption.updateMany({ where: { checkoutId, status: "RESERVED" }, data: { status: "USED" } });
        await tx.outboxJob.createMany({ data: notificationJobs(order.id, !checkout.squareCustomerId) });
        // Ordered with a friend's invite code: the friend gets their points now.
        await creditInvite(tx, order);
        return order;
      });
      await lampForSale(cart.shopLines?.length ? (cart.shop === "coastline" ? "coastline" : "lightlab") : "print", checkout.totalCents + checkout.giftCardCents);
      return { order, created: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Either another request finalized this checkout first, or (very
        // rarely) the random order number collided. Check which.
        const winner = await db.order.findUnique({ where: { checkoutId } });
        if (winner) return { order: winner, created: false };
        continue;
      }
      throw err;
    }
  }
  const err = new Error(`Could not allocate an order number for checkout ${checkoutId}`);
  logError("finalize", err);
  throw err;
}

function orderItemData(line: CartSnapshot["lines"][number], q: ItemQuote) {
  if (!q.ok) throw new Error("Cannot create an order item from an unprintable line");
  return {
    uploadId: line.uploadId,
    fileName: line.fileName,
    unitFactor: line.unitFactor,
    scaleX: line.scale.x,
    scaleY: line.scale.y,
    scaleZ: line.scale.z,
    orientation: q.assignment.orientation,
    sizeX: q.assignment.orientedSize.x,
    sizeY: q.assignment.orientedSize.y,
    sizeZ: q.assignment.orientedSize.z,
    material: line.material,
    colorId: line.colorId,
    colorName: line.colorName,
    colorSlots: line.colorSlots ? JSON.stringify(line.colorSlots) : null,
    quality: line.quality,
    infill: line.infill,
    quantity: line.quantity,
    printerId: q.assignment.printer.id,
    printerName: q.assignment.printer.name,
    gramsEach: q.gramsEach,
    hoursEach: q.hoursEach,
    unitCents: q.unitCents,
    lineCents: q.lineCents,
  };
}

/** A shop product as an order item. Print fields hold the product's packed size and a shop label. */
function shopItemData(line: PricedShopLine, shopId?: ShopId) {
  const shop = shopConfig(shopId);
  return {
    productId: line.productId,
    variantId: line.variantId,
    // A personalised product carries its text in the name, so the admin, receipts and emails all show it.
    fileName: line.customText ? `${line.name}: "${line.customText}"` : line.name,
    unitFactor: 1,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    orientation: 0,
    sizeX: line.size.x,
    sizeY: line.size.y,
    sizeZ: line.size.z,
    material: shop.itemMaterial,
    colorId: line.variantId ?? "",
    colorName: line.variantName ?? "",
    quality: "",
    infill: "",
    quantity: line.quantity,
    printerId: shop.itemPrinterId,
    printerName: shop.itemPrinter,
    gramsEach: line.grams,
    hoursEach: 0,
    unitCents: line.unitCents,
    lineCents: line.lineCents,
  };
}

/** Sold: take them off the shelf (the option's count if it has one, else the product's). Never below zero. */
async function takeStock(tx: Prisma.TransactionClient, line: PricedShopLine, orderId: string, shopId?: ShopId) {
  const { lowStockAt } = shopConfig(shopId);
  const p = await tx.shopProduct.findUnique({ where: { id: line.productId } });
  if (!p) return;
  const variants = JSON.parse(p.variants) as { id: string; stock: number | null }[];
  const v = line.variantId ? variants.find((x) => x.id === line.variantId) : null;
  let before: number;
  let after: number;
  if (v && v.stock != null) {
    before = v.stock;
    after = v.stock = Math.max(0, v.stock - line.quantity);
    await tx.shopProduct.update({ where: { id: p.id }, data: { variants: JSON.stringify(variants) } });
  } else if (p.stock != null) {
    before = p.stock;
    after = Math.max(0, p.stock - line.quantity);
    await tx.shopProduct.update({ where: { id: p.id }, data: { stock: after } });
  } else {
    return; // made to order
  }
  // Running low or sold out: tell the owner (once per crossing).
  if ((after === 0 && before > 0) || (after <= lowStockAt && before > lowStockAt)) {
    const pool = v && v.stock != null ? v.id : "";
    const dedupeKey = `${orderId}:stock:${p.id}:${pool}`;
    const payload = JSON.stringify({ orderId, productId: p.id, variantId: pool, left: after });
    // Two lines can share one stock count: keep a single alert with the latest count.
    await tx.outboxJob.upsert({ where: { dedupeKey }, create: { kind: "email", template: "lightlab-stock-alert", payload, dedupeKey }, update: { payload } });
  }
}

/** Queued in the same transaction as the order, so a mail outage can't lose them (sent in Phase 4). */
/**
 * What goes out for a new order. Emails, the ticket print and Discord wait
 * for the send-off animation (see notify/sendoff); the Square customer sync
 * doesn't, since the customer never sees it.
 */
function notificationJobs(orderId: string, needsSquareCustomer: boolean): Prisma.OutboxJobCreateManyInput[] {
  const held = sendOffHold();
  const jobs: Prisma.OutboxJobCreateManyInput[] = [
    // Square was slow or unreachable at checkout: save the customer to Square in the background.
    ...(needsSquareCustomer && process.env.SQUARE_ACCESS_TOKEN
      ? [{ kind: "square", template: "customer-sync", payload: JSON.stringify({ orderId }), dedupeKey: `${orderId}:customer-sync` }]
      : []),
    { kind: "email", template: "owner-new-order", payload: JSON.stringify({ orderId }), dedupeKey: `${orderId}:owner-new-order`, nextAttemptAt: held },
    { kind: "email", template: "customer-receipt", payload: JSON.stringify({ orderId }), dedupeKey: `${orderId}:customer-receipt`, nextAttemptAt: held },
  ];
  if (process.env.RECEIPT_PRINTER_HOST) {
    jobs.push({ kind: "print", template: "order-receipt", payload: JSON.stringify({ orderId }), dedupeKey: `${orderId}:order-receipt`, nextAttemptAt: held });
  }
  if (process.env.DISCORD_WEBHOOK_URL) {
    jobs.push({ kind: "discord", template: "discord-new-order", payload: JSON.stringify({ orderId }), dedupeKey: `${orderId}:discord-new-order`, nextAttemptAt: held });
  }
  return jobs;
}
