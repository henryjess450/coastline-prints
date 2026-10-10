import "server-only";
import { pickup } from "@config/pickup";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { hours, money } from "@/lib/format";
import { nextStep } from "@/lib/orders/next-step";
import { addDays, formatPickup, todayIn } from "@/lib/pickup";
import { isTracked } from "@/lib/shipping/address";
import type { AdminCard } from "@/components/admin/OrderCard";

const include = { items: { select: { fileName: true, quantity: true, material: true, colorName: true, printerName: true, hoursEach: true } } } satisfies Prisma.OrderInclude;
type Row = Prisma.OrderGetPayload<{ include: typeof include }>;

/** Orders as the admin's cards: who, what, when, and the one-tap next step. */
export async function adminCards(where: Prisma.OrderWhereInput, take = 200): Promise<AdminCard[]> {
  const rows = await db.order.findMany({ where, include, orderBy: { createdAt: "asc" }, take });
  const today = todayIn(pickup.timeZone);
  return rows.map((o) => toCard(o, today));
}

function toCard(o: Row, today: string): AdminCard {
  const ships = o.fulfillment === "SHIP";
  const pieces = o.items.reduce((n, i) => n + i.quantity, 0);
  const first = o.items[0];
  const printHours = o.items.reduce((h, i) => h + i.hoursEach * i.quantity, 0);
  // Pickup day: today, tomorrow, overdue, or later.
  const due = ships || !o.pickupDate || o.status === "PICKED_UP" ? null : o.pickupDate < today ? "late" : o.pickupDate === today ? "today" : o.pickupDate === addDays(today, 1) ? "tomorrow" : "later";
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    fulfillment: o.fulfillment,
    customer: o.customerName,
    firstName: o.customerName.trim().split(/\s+/)[0] || "them",
    returning: o.customerOrderCount > 1,
    summary: first ? `${first.fileName} × ${first.quantity} · ${first.material} ${first.colorName}` : "",
    more: o.items.length - 1,
    pieces,
    printers: [...new Set(o.items.map((i) => i.printerName.replace(/^(Bambu Lab|Elegoo) /, "")))].join(", "),
    printTime: hours(printHours),
    when: ships ? `Ship to ${o.shipCity}, ${o.shipProvince}` : (formatPickup(o.pickupDate, o.pickupTime, pickup) ?? "Pickup not booked"),
    due,
    total: money(o.totalCents),
    next: nextStep(o.status, o.fulfillment, isTracked(o)),
  };
}

/** Now, and a week ago (read once per request, outside rendering). */
export function adminClock() {
  const now = new Date();
  return { now, weekAgo: new Date(now.getTime() - 7 * 86_400_000) };
}
