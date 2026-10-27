import "server-only";
import { getSquare, squareLocationId, squarePublicConfig } from "@/lib/square/client";
import { shopConfig } from "@config/shops";
import type { PosBrand } from "./types";

/**
 * Square payment links for the register: the customer scans a QR code on the
 * display and pays on their own phone (card, Apple Pay, Google Pay). The
 * register watches the link's Square order and rings up the sale once it's
 * paid, with the real payment saved on the order.
 */

export const payLinksAvailable = () => !!squarePublicConfig();

export async function createPayLink(attemptId: string, amountCents: number, brand: PosBrand) {
  const { paymentLink } = await getSquare().checkout.paymentLinks.create({
    // Same sale and amount: the same link, however many times it's asked for.
    idempotencyKey: `pos-${attemptId}-${amountCents}`,
    quickPay: { name: `${shopConfig(brand).name.replace(" shop", "")} purchase`, priceMoney: { amount: BigInt(amountCents), currency: "CAD" }, locationId: squareLocationId() },
    paymentNote: "In-person sale at the register",
  });
  if (!paymentLink?.id || !paymentLink.url || !paymentLink.orderId) throw new Error("Square returned no payment link");
  return { linkId: paymentLink.id, url: paymentLink.url, orderId: paymentLink.orderId };
}

/** Paid yet? The link's order has a tender and nothing left owing once it is. */
export async function payLinkStatus(orderId: string) {
  const { order } = await getSquare().orders.get({ orderId });
  const tender = order?.tenders?.[0];
  const due = Number(order?.netAmountDueMoney?.amount ?? 1);
  if (!tender || due > 0) return { paid: false as const };
  return { paid: true as const, paymentId: tender.paymentId ?? tender.id ?? "" };
}

/** Cart changed or they paid another way: the old link stops working. */
export async function cancelPayLink(linkId: string) {
  await getSquare().checkout.paymentLinks.delete({ id: linkId });
}
