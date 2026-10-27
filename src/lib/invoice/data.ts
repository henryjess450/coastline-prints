import "server-only";
import { isAdminOrder, manualPaymentLabel } from "@/lib/orders/manual";
import { pickup } from "@config/pickup";
import { legal, site } from "@config/site";
import type { AppliedCode } from "@/lib/codes/apply";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import { formatPickup } from "@/lib/pickup";
import { shippingAddressLines, shippingSummary } from "@/lib/shipping/address";
import { isLightLabOrder } from "@/lib/shop/brand";
import { lightlab } from "@config/lightlab";

/**
 * One order's invoice as plain data: the web page, the PDF and the email
 * attachment all draw from this, so they always agree. Never includes the
 * pickup address.
 */
export type InvoiceData = {
  orderNumber: string;
  viewToken: string;
  /** "October 9, 2026" */
  date: string;
  business: { name: string; email: string };
  /** LightLab shop orders carry the LightLab logo and name instead of Coastline's. */
  brand: "coastline" | "lightlab";
  customer: { name: string; email: string };
  /** Pickup time, or the address it ships to. */
  delivery: { kind: "pickup"; when: string } | { kind: "ship"; lines: string[] };
  items: { name: string; detail: string; quantity: number; cents: number }[];
  /** Fees, discounts and shipping after the items; `minus` lines come off. */
  extras: { label: string; cents: number; minus?: boolean }[];
  totalCents: number;
  /** "Visa ending 4242" */
  paidBy: string;
  giftCardCents: number;
  /** The order's private page (also what the QR codes open). */
  url: string;
};

export function invoiceFileName(orderNumber: string, brand: InvoiceData["brand"] = "coastline") {
  return `${brand === "lightlab" ? lightlab.shortName : site.name.replace(/\s+/g, "-")}-invoice-${orderNumber}.pdf`;
}

const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export async function loadInvoice(where: { id: string } | { viewToken: string }): Promise<InvoiceData | null> {
  const o = await db.order.findUnique({ where, include: { items: true } });
  if (!o) return null;
  const codes = JSON.parse(o.appliedCodes) as AppliedCode[];
  const shipTo = shippingAddressLines(o);
  const shop = isLightLabOrder(o.items);
  return {
    orderNumber: o.orderNumber,
    viewToken: o.viewToken,
    date: o.createdAt.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: pickup.timeZone }),
    business: { name: shop ? lightlab.name : site.name, email: legal.contactEmail },
    brand: shop ? "lightlab" : "coastline",
    customer: { name: o.customerName, email: o.customerEmail },
    delivery: shipTo ? { kind: "ship", lines: shipTo } : { kind: "pickup", when: formatPickup(o.pickupDate, o.pickupTime, pickup) ?? "Local pickup" },
    items: o.items.map((i) => ({
      name: i.fileName,
      detail: i.productId ? [lightlab.name, i.colorName].filter(Boolean).join(" · ") : `${i.material} ${i.colorName} · ${i.sizeX.toFixed(0)} × ${i.sizeY.toFixed(0)} × ${i.sizeZ.toFixed(0)} mm`,
      quantity: i.quantity,
      cents: i.lineCents,
    })),
    extras: [
      ...(o.baseFeeCents ? [{ label: "Order fee", cents: o.baseFeeCents }] : []),
      ...(o.minimumAdjCents ? [{ label: "Minimum order top-up", cents: o.minimumAdjCents }] : []),
      ...codes.filter((c) => c.kind !== "GIFT_CARD").map((c) => ({ label: c.label, cents: c.amountCents, minus: true })),
      ...(o.etransferDiscountCents ? [{ label: "e-Transfer discount", cents: o.etransferDiscountCents, minus: true }] : []),
      ...(o.shippingCents ? [{ label: `Shipping, ${shippingSummary(o)} (GST included)`, cents: o.shippingCents }] : []),
      // Gift cards are a way of paying, so they come off last.
      ...codes.filter((c) => c.kind === "GIFT_CARD").map((c) => ({ label: c.label, cents: c.amountCents, minus: true })),
    ],
    totalCents: o.totalCents,
    paidBy: manualPaymentLabel(o.paymentMethod) ?? (o.paymentMethod === "ETRANSFER" ? "Interac e-Transfer" : o.cardLast4 ? `${titleCase(o.cardBrand ?? "Card")} ending ${o.cardLast4}` : o.totalCents === 0 && !isAdminOrder(o) ? "Gift card" : "Card"),
    giftCardCents: o.giftCardCents,
    url: `${appUrl()}/orders/${o.viewToken}`,
  };
}
