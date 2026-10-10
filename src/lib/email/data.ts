import "server-only";
import { pickup } from "@config/pickup";
import { privateSite } from "@config/private.server";
import { db } from "@/lib/db";
import { hours, returningLabel } from "@/lib/format";
import type { AppliedCode } from "@/lib/codes/apply";
import { formatPickup } from "@/lib/pickup";
import { trackingUrl } from "@/lib/orders/status";
import { isTracked, shippingAddressLines, shippingSummary } from "@/lib/shipping/address";

/** Everything an order email needs, as plain data (easy to render and to test). */
export type OrderEmailData = {
  orderId: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string | null;
  items: {
    fileName: string;
    quantity: number;
    material: string;
    colorName: string;
    quality: string;
    infill: string;
    size: string;
    printerName: string;
    grams: number;
    hoursLabel: string;
    lineCents: number;
  }[];
  baseFeeCents: number;
  minimumAdjCents: number;
  /** Coupon and gift card lines, already labelled (gift cards masked). */
  discounts: { label: string; amountCents: number }[];
  /** "Returning customer · 3rd order" or null. */
  returning: string | null;
  totalCents: number;
  totalGrams: number;
  totalHoursLabel: string;
  card: string | null;
  fulfillment: "PICKUP" | "SHIP";
  /** Null for shipped orders: they must never be sent the pickup address. */
  pickupAddress: string | null;
  shippingCents: number;
  /** The customer's address as lines, for shipped orders. */
  shipTo: string[] | null;
  /** "Canada Post · 1 Medium box" */
  shippingLabel: string | null;
  tracking: { number: string; url: string } | null;
  /** False for bubble mailers (Lettermail). */
  tracked: boolean;
  /** "Friday, October 10, 4 to 5 pm", or null for orders placed before booking existed. */
  pickupWhen: string | null;
  links: { confirmation: string; status: string; admin: string; invoice: string; receipt: string | null };
};

export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function loadOrderEmailData(orderId: string): Promise<OrderEmailData | null> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return null;
  const base = appUrl();
  const ship = order.fulfillment === "SHIP";
  const totalHours = order.items.reduce((h, i) => h + i.hoursEach * i.quantity, 0);
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    notes: order.notes,
    items: order.items.map((i) => ({
      fileName: i.fileName,
      quantity: i.quantity,
      material: i.material,
      colorName: i.colorName,
      quality: i.quality,
      infill: i.infill,
      size: `${i.sizeX.toFixed(1)} × ${i.sizeY.toFixed(1)} × ${i.sizeZ.toFixed(1)} mm`,
      printerName: i.printerName,
      grams: i.gramsEach * i.quantity,
      hoursLabel: hours(i.hoursEach * i.quantity),
      lineCents: i.lineCents,
    })),
    baseFeeCents: order.baseFeeCents,
    minimumAdjCents: order.minimumAdjCents,
    discounts: [
      ...(JSON.parse(order.appliedCodes) as AppliedCode[]).map((a) => ({ label: a.label, amountCents: a.amountCents })),
      ...(order.etransferDiscountCents > 0 ? [{ label: "e-Transfer discount", amountCents: order.etransferDiscountCents }] : []),
    ],
    returning: returningLabel(order.customerOrderCount),
    totalCents: order.totalCents,
    totalGrams: order.items.reduce((g, i) => g + i.gramsEach * i.quantity, 0),
    totalHoursLabel: hours(totalHours),
    card: order.paymentMethod === "ETRANSFER" ? "Interac e-Transfer" : order.cardLast4 ? `${brand(order.cardBrand)} ending ${order.cardLast4}` : order.totalCents === 0 ? "Gift card" : null,
    fulfillment: ship ? "SHIP" : "PICKUP",
    pickupAddress: ship ? null : privateSite.pickupAddress,
    shippingCents: order.shippingCents,
    shipTo: shippingAddressLines(order),
    shippingLabel: ship ? shippingSummary(order) : null,
    tracked: ship && isTracked(order),
    tracking: ship && order.trackingNumber ? { number: order.trackingNumber, url: trackingUrl(order.trackingNumber) } : null,
    pickupWhen: formatPickup(order.pickupDate, order.pickupTime, pickup),
    links: {
      confirmation: `${base}/orders/${order.viewToken}`,
      status: `${base}/status?order=${encodeURIComponent(order.orderNumber)}`,
      admin: `${base}/admin/orders/${order.id}`,
      invoice: `${base}/orders/${order.viewToken}/invoice`,
      receipt: order.receiptUrl,
    },
  };
}

function brand(b: string | null) {
  if (!b) return "Card";
  return b
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
