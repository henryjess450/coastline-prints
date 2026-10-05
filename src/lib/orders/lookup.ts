import "server-only";
import { pickup } from "@config/pickup";
import { db } from "@/lib/db";
import { formatPickup } from "@/lib/pickup";

/** What the public status page may show: no address, phone or payment details. */
export type CustomerOrderView = {
  orderNumber: string;
  status: string;
  placedAt: string;
  pickupWhen: string | null;
  items: { fileName: string; quantity: number; material: string; colorName: string }[];
  history: { status: string; at: string }[];
};

/** Both the order number and the email must match. */
export async function findOrderForCustomer(orderNumber: string, email: string): Promise<CustomerOrderView | null> {
  const order = await db.order.findUnique({
    where: { orderNumber: orderNumber.trim().toUpperCase() },
    include: { items: true, events: { orderBy: { createdAt: "asc" } } },
  });
  if (!order || order.customerEmail.toLowerCase() !== email.trim().toLowerCase()) return null;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.createdAt.toISOString(),
    pickupWhen: formatPickup(order.pickupDate, order.pickupTime, pickup),
    items: order.items.map((i) => ({ fileName: i.fileName, quantity: i.quantity, material: i.material, colorName: i.colorName })),
    history: order.events.map((e) => ({ status: e.toStatus, at: e.createdAt.toISOString() })),
  };
}
