import "server-only";
import { logError } from "@/lib/api";
import { CodeError, releaseCodes, reserveCodes } from "@/lib/codes/server";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { changeOrderStatus } from "@/lib/orders/admin";
import { finalizeCheckout, paymentFacts, type PaymentFacts } from "@/lib/orders/finalize";
import { getSquare } from "@/lib/square/client";
import { ADMIN_PAYMENT_PREFIX } from "@/lib/orders/manual";
import { pricePos, publicQuote } from "./price.server";
import { pushScreen } from "./register.server";
import type { PosQuote, PosSaleInput } from "./types";
import { orderMinDate, posSaleSchema } from "./types";
import { createInvitedAccount, normalizeEmail } from "@/lib/account/auth";

export class PosSaleError extends Error {
  constructor(message: string, readonly quote?: PosQuote) {
    super(message);
  }
}

/**
 * Rings up a register sale: re-prices the cart, holds any gift card balance
 * or coupon, and creates the order through the same finalize step as online
 * checkout (order number, ticket, lamp, Square customer when there's an
 * email). Things they walk away with are marked picked up straight away,
 * which also earns their Coastline Rewards points.
 */
export async function ringUpSale(raw: PosSaleInput) {
  const sale = posSaleSchema.parse(raw);

  const previous = await db.checkout.findUnique({ where: { idempotencyKey: sale.attemptId }, include: { order: true } });
  if (previous?.order) return { order: previous.order, emailed: false };
  if (previous) throw new PosSaleError("This sale didn't go through. Start it again.");

  const priced = await pricePos({ ...sale.cart, email: sale.customer.email });
  if (!priced.ok) throw new PosSaleError(priced.error ?? "Something in the cart can't be sold.", publicQuote(priced));
  if (priced.totalCents !== sale.expectedTotalCents) throw new PosSaleError(`The total changed to ${money(priced.totalCents)}. Check it with the customer.`, publicQuote(priced));
  if (sale.payment === "CASH" && sale.tenderedCents != null && sale.tenderedCents < priced.totalCents) throw new PosSaleError("That's less cash than the total.");
  if (sale.order) {
    // Start order: paid now by cash or e-Transfer, made later, and they need an email for the account and updates.
    if (!sale.customer.email) throw new PosSaleError("An order needs the customer's email.");
    if (sale.payment !== "CASH" && sale.payment !== "ETRANSFER") throw new PosSaleError("Orders are paid by cash or e-Transfer.");
    if (sale.squarePaymentId) throw new PosSaleError("Orders are paid by cash or e-Transfer.");
    if (sale.order.needBy < orderMinDate()) throw new PosSaleError("The day they need it by has to be at least a week away.");
  }

  // Paid by Square link: the payment must be real, complete, for this total, and not already on an order.
  let squarePayment: PaymentFacts | null = null;
  if (sale.squarePaymentId) {
    if (await db.order.findUnique({ where: { squarePaymentId: sale.squarePaymentId } })) throw new PosSaleError("That Square payment is already on another order.");
    const { payment } = await getSquare().payments.get({ paymentId: sale.squarePaymentId });
    squarePayment = payment ? paymentFacts(payment) : null;
    if (!squarePayment || squarePayment.status !== "COMPLETED") throw new PosSaleError("Square hasn't finished that payment yet.");
    if (squarePayment.amountCents !== priced.totalCents) throw new PosSaleError(`Square took ${money(squarePayment.amountCents)}, but the total is ${money(priced.totalCents)}. Check the sale.`);
  }

  const change = sale.payment === "CASH" && sale.tenderedCents != null ? sale.tenderedCents - priced.totalCents : null;
  const email = sale.customer.email;
  const checkout = await db.checkout.create({
    data: {
      idempotencyKey: sale.attemptId,
      source: sale.source,
      firstSource: sale.source,
      sourceDetail: JSON.stringify({ manual: true, pos: true, last: null, first: null }),
      cart: JSON.stringify(priced.snapshot),
      totalCents: priced.totalCents,
      discountCents: priced.discountCents,
      giftCardCents: priced.giftCardCents,
      appliedCodes: JSON.stringify(priced.applied),
      paymentMethod: squarePayment ? "CARD" : sale.payment,
      customerName: sale.customer.name || "Walk-in customer",
      customerEmail: email,
      customerPhone: sale.customer.phone,
      notes: sale.customer.notes || null,
      fulfillment: "PICKUP",
      pickupDate: sale.order?.needBy ?? null,
    },
  });

  try {
    await reserveCodes(checkout.id, priced.applied, priced.records);
  } catch (err) {
    await db.checkout.update({ where: { id: checkout.id }, data: { status: "FAILED", failureReason: "code reservation failed" } });
    await releaseCodes(checkout.id);
    if (err instanceof CodeError) throw new PosSaleError(err.message);
    throw err;
  }

  const paid = sale.payment === "CASH" && sale.tenderedCents != null ? `Cash ${money(sale.tenderedCents)}, change ${money(change!)}` : null;
  let result;
  try {
    result = await finalizeCheckout(
      checkout.id,
      squarePayment ?? { id: `${ADMIN_PAYMENT_PREFIX}${checkout.id}`, status: "COMPLETED", amountCents: checkout.totalCents, currency: checkout.currency },
      {
        note: [sale.order ? "Order taken at the register" : "Rung up at the register", sale.source, squarePayment ? "Paid by Square link" : paid].filter(Boolean).join(" · "),
        emailCustomer: sale.order ? true : sale.emailCustomer,
        printTicket: sale.printTicket,
        takenOrder: !!sale.order,
      },
    );
  } catch (err) {
    await releaseCodes(checkout.id);
    throw err;
  }
  if (!result) {
    await releaseCodes(checkout.id);
    throw new PosSaleError("Couldn't save the sale.");
  }

  if (result.created && sale.order) await accountForOrder(email, sale.customer.name, sale.customer.phone).catch((e) => logError("pos:order-account", e));
  if (result.created && sale.handedOver && !sale.order) {
    await changeOrderStatus(result.order.id, "PICKED_UP", { note: "Handed over at the register" }).catch((e) => logError("pos:handed-over", e));
  }
  if (result.created) sendNotificationsSoon("pos-sale");

  const emailed = !!email && (sale.emailCustomer || !!sale.order);
  if (sale.registerId) {
    await pushScreen(sale.registerId, {
      stage: "done",
      brand: sale.cart.brand,
      lines: priced.lines,
      fees: priced.fees,
      discounts: priced.discounts,
      totalCents: priced.totalCents,
      payment: squarePayment ? "LINK" : sale.payment,
      tenderedCents: sale.tenderedCents,
      email: email || undefined,
      orderFor: sale.order ? sale.customer.name || undefined : undefined,
      needBy: sale.order?.needBy,
      orderNumber: result.order.orderNumber,
      emailed,
      popup: null,
    }, { clearReply: true }).catch((e) => logError("pos:screen", e));
  }
  return { order: result.order, emailed, changeCents: change };
}

/**
 * Start order makes their account (their receipt email signs them in), or
 * uses the one they have. Fills in a name and phone it doesn't have yet.
 */
async function accountForOrder(rawEmail: string, name: string, phone: string) {
  const email = normalizeEmail(rawEmail);
  const made = await createInvitedAccount(email, name || null);
  if (made) {
    if (phone) await db.customer.update({ where: { id: made.id }, data: { phone } });
    return;
  }
  const existing = await db.customer.findUnique({ where: { email } });
  if (existing && (!existing.name || !existing.phone)) await db.customer.update({ where: { id: existing.id }, data: { name: existing.name || name || null, phone: existing.phone || phone || null } });
}
