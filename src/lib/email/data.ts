import { pickupPlaceFor } from "@/lib/shop/market-pickup.server";
import "server-only";
import { isAdminOrder, manualPaymentLabel } from "@/lib/orders/manual";
import { pickup } from "@config/pickup";
import { db } from "@/lib/db";
import { hours, returningLabel } from "@/lib/format";
import type { AppliedCode } from "@/lib/codes/apply";
import { formatPickup } from "@/lib/pickup";
import { trackingUrl } from "@/lib/orders/status";
import { isLightLabOrder } from "@/lib/shop/brand";
import { upcomingMarkets } from "@/lib/shop/markets.server";
import { clock, type MarketDto } from "@/lib/shop/markets";
import { shopImageUrl } from "@/lib/shop/types";
import { isTracked, shippingAddressLines, shippingSummary } from "@/lib/shipping/address";

/** Everything an order email needs, as plain data (easy to render and to test). */
export type OrderEmailData = {
  /** A LightLab shop order: its customer emails carry the LightLab logo. */
  lightlab: boolean;
  /** Shop products (LightLab or the Coastline shop), not uploaded files. */
  products: boolean;
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
    /** A LightLab product bought ready-made (no print settings to show). */
    product: boolean;
    /** Its cover photo (full URL), for the LightLab emails. */
    image?: string | null;
  }[];
  /** Sold in person (the stand register or the kiosk) and handed over there. */
  inPerson?: boolean;
  /** Where it was sold in person, like "LightLab market stall". */
  source?: string | null;
  /** LightLab: the next market, for the footer. */
  nextMarket?: { name: string; when: string } | null;
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
  /** Picked up at a LightLab market day: pickupAddress is the market, and it isn't private. */
  atMarket?: boolean;
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
  const place = ship ? null : await pickupPlaceFor(order);
  const totalHours = order.items.reduce((h, i) => h + i.hoursEach * i.quantity, 0);
  const lightlab = isLightLabOrder(order.items);
  const productIds = order.items.map((i) => i.productId).filter((id): id is string => !!id);
  const products = productIds.length ? await db.shopProduct.findMany({ where: { id: { in: productIds } }, select: { id: true, images: true } }) : [];
  const cover = (id: string | null) => {
    const keys = JSON.parse(products.find((p) => p.id === id)?.images ?? "[]") as string[];
    return keys[0] ? `${base}${shopImageUrl(keys[0])}` : null;
  };
  const next = lightlab ? (await upcomingMarkets(1).catch(() => []))[0] : null;
  return {
    lightlab,
    // Rung up at the stand register or the kiosk and handed over there (not an order taken to make later).
    inPerson: soldInPerson(order.sourceDetail) && order.fulfillment !== "SHIP" && !order.pickupDate,
    source: order.source,
    nextMarket: next ? { name: next.name, when: marketWhen(next) } : null,
    products: order.items.some((i) => !!i.productId),
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
      product: !!i.productId,
      image: cover(i.productId),
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
    card: manualPaymentLabel(order.paymentMethod) ?? (order.paymentMethod === "ETRANSFER" ? "Interac e-Transfer" : order.cardLast4 ? `${brand(order.cardBrand)} ending ${order.cardLast4}` : isAdminOrder(order) ? (order.paymentMethod === "CARD" ? "Card (in person)" : null) : order.totalCents === 0 ? "Gift card" : null),
    fulfillment: ship ? "SHIP" : "PICKUP",
    pickupAddress: place?.address ?? null,
    atMarket: !!place?.market,
    shippingCents: order.shippingCents,
    shipTo: shippingAddressLines(order),
    shippingLabel: ship ? shippingSummary(order) : null,
    tracked: ship && isTracked(order),
    tracking: ship && order.trackingNumber ? { number: order.trackingNumber, url: trackingUrl(order.trackingNumber) } : null,
    pickupWhen: place?.market?.when ?? formatPickup(order.pickupDate, order.pickupTime, pickup),
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

/** "Saturday, November 28 · 10 am to 4 pm" */
export function marketWhen(m: MarketDto) {
  const day = new Date(`${m.date}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  return `${day} · ${clock(m.startTime)} to ${clock(m.endTime)}`;
}

function soldInPerson(sourceDetail: string | null) {
  try {
    return !!(JSON.parse(sourceDetail ?? "{}") as { pos?: boolean }).pos;
  } catch {
    return false;
  }
}
