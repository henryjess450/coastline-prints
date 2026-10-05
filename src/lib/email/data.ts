import "server-only";
import { pickup } from "@config/pickup";
import { privateSite } from "@config/private.server";
import { db } from "@/lib/db";
import { hours } from "@/lib/format";
import { formatPickup } from "@/lib/pickup";

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
  totalCents: number;
  totalGrams: number;
  totalHoursLabel: string;
  card: string | null;
  pickupAddress: string;
  /** "Friday, October 10, 4 to 5 pm", or null for orders placed before booking existed. */
  pickupWhen: string | null;
  links: { confirmation: string; status: string; admin: string; receipt: string | null };
};

export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function loadOrderEmailData(orderId: string): Promise<OrderEmailData | null> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return null;
  const base = appUrl();
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
    totalCents: order.totalCents,
    totalGrams: order.items.reduce((g, i) => g + i.gramsEach * i.quantity, 0),
    totalHoursLabel: hours(totalHours),
    card: order.cardLast4 ? `${brand(order.cardBrand)} ending ${order.cardLast4}` : null,
    pickupAddress: privateSite.pickupAddress,
    pickupWhen: formatPickup(order.pickupDate, order.pickupTime, pickup),
    links: {
      confirmation: `${base}/orders/${order.viewToken}`,
      status: `${base}/status?order=${encodeURIComponent(order.orderNumber)}`,
      admin: `${base}/admin/orders/${order.id}`,
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
