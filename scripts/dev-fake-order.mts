/**
 * DEV ONLY: creates a paid test order in the local database without Square,
 * so the confirmation page and (later) emails/admin can be previewed.
 *   npx tsx --conditions=react-server scripts/dev-fake-order.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

if (process.env.NODE_ENV === "production" || process.env.SQUARE_ENVIRONMENT === "production") {
  throw new Error("Refusing to create fake orders in production.");
}

const { db } = await import("../src/lib/db");
const { priceCart } = await import("../src/lib/pricing/server-quote");
const { finalizeCheckout } = await import("../src/lib/orders/finalize");
const { pickup } = await import("../config/pickup");
const { availableDays } = await import("../src/lib/pickup");
const slotDay = availableDays(pickup).find((d) => d.slots.length > 4) ?? availableDays(pickup)[0];

const upload =
  (await db.upload.findFirst({ where: { boundaryEdges: 0, bboxX: { gt: 5, lt: 150 } }, orderBy: { createdAt: "desc" } })) ??
  (() => {
    throw new Error("Upload a model on /order first.");
  })();

const items = [
  { uploadId: upload.id, unitFactor: 1 as const, scale: { x: 1, y: 1, z: 1 }, material: "PLA" as const, colorId: "dark-blue", quality: "standard", infill: "standard", quantity: 2 },
  { uploadId: upload.id, unitFactor: 1 as const, scale: { x: 1.5, y: 1.5, z: 1.5 }, material: "PETG" as const, colorId: "tinmorry-transparent-blue", quality: "fine", infill: "strong", quantity: 1 },
];
const priced = await priceCart(items);
const { config: _c, ...quote } = priced;
void _c;
const checkout = await db.checkout.create({
  data: {
    idempotencyKey: randomUUID(),
    cart: JSON.stringify({ lines: priced.lines, quote }),
    totalCents: priced.totalCents,
    customerName: "Sam Rivers",
    customerEmail: "sam@example.com",
    customerPhone: "604 555 0123",
    notes: "Test order created by scripts/dev-fake-order.mts",
    pickupDate: slotDay.date,
    pickupTime: slotDay.slots[1].time,
  },
});
const result = await finalizeCheckout(checkout.id, {
  id: `dev_${randomUUID().slice(0, 12)}`,
  status: "COMPLETED",
  amountCents: priced.totalCents,
  currency: "CAD",
  receiptUrl: "https://squareup.com/receipt/preview/dev",
  cardBrand: "VISA",
  last4: "1111",
});
console.log(`Order ${result!.order.orderNumber}: http://localhost:3000/orders/${result!.order.viewToken}`);
await db.$disconnect();
