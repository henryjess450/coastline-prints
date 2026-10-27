import { z } from "zod";
import { addressSchema } from "@/lib/checkout/schema";
import { cartItemSchema } from "@/lib/pricing/cart-schema";
import { shopLineSchema } from "@/lib/shop/schema";
import { lightlab } from "@config/lightlab";
import { uploads } from "@config/site";

/**
 * Orders the owner types in from the admin: a Marketplace sale, a market
 * stall, a DM. Priced the same way as the site (an uploaded file or shop
 * products), then saved through the same finalize step as a checkout, so
 * they get an order number, a ticket and a place on the board. Where it came
 * from is free text, saved as the order's source for the Sources page.
 */

/** Suggestions for "Where's it from?". Anything else can be typed. */
export const SOURCE_SUGGESTIONS = ["Facebook Marketplace", "LightLab market stall", "Instagram DM", "In person", "Text or phone", "Email", "Kijiji", "Etsy", "Friend or family"];

/** How a typed-in order was paid. CARD and ETRANSFER match the site's own values. */
export const MANUAL_PAYMENTS = [
  { id: "CASH", label: "Cash" },
  { id: "ETRANSFER", label: "e-Transfer" },
  { id: "CARD", label: "Card (in person)" },
  { id: "OTHER", label: "Other" },
  { id: "UNPAID", label: "Not paid yet" },
] as const;
export type ManualPayment = (typeof MANUAL_PAYMENTS)[number]["id"];
const PAYMENT_IDS = MANUAL_PAYMENTS.map((p) => p.id) as [ManualPayment, ...ManualPayment[]];

/** Payment ids stored on admin-made orders start with this. */
export const ADMIN_PAYMENT_PREFIX = "admin_";
/** The discount line when the owner charges less than the site price. */
export const ADJUSTMENT_CODE = "ADJUSTMENT";

/** "Cash", "Not paid yet"... for the payment methods only typed-in orders use; null for card/e-Transfer (shown their own way). */
export function manualPaymentLabel(method: string) {
  if (method === "CASH") return "Cash";
  if (method === "OTHER") return "Other";
  if (method === "UNPAID") return "Not paid yet";
  return null;
}

export const isAdminOrder = (o: { squarePaymentId: string }) => o.squarePaymentId.startsWith(ADMIN_PAYMENT_PREFIX);

export const manualOrderSchema = z
  .object({
    /** One id per form, so a double tap can't make two orders. */
    attemptId: z.string().uuid(),
    source: z.string().trim().min(2, "Say where the order came from.").max(60),
    customer: z.object({
      name: z.string().trim().min(2, "Enter the customer's name.").max(100),
      email: z.union([z.literal(""), z.string().trim().toLowerCase().email("That email doesn't look right.").max(200)]).default(""),
      phone: z.string().trim().max(30).default(""),
      notes: z.string().trim().max(1000).default(""),
    }),
    fulfillment: z.discriminatedUnion("method", [
      z.object({ method: z.literal("pickup"), date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default(""), time: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]).default("") }),
      z.object({ method: z.literal("ship"), address: addressSchema, shippingCents: z.number().int().min(0).max(100_000) }),
    ]),
    items: z.array(cartItemSchema).max(uploads.maxFilesPerOrder).default([]),
    products: z.array(shopLineSchema).max(lightlab.maxLinesPerOrder).default([]),
    payment: z.enum(PAYMENT_IDS),
    /** Charge less than the site price (before shipping). Null = the site price. */
    priceCents: z.number().int().min(0).max(10_000_000).nullable().default(null),
    /** Email the customer their receipt (only if there's an email). */
    emailCustomer: z.boolean().default(false),
    printTicket: z.boolean().default(true),
  })
  .refine((b) => (b.items.length > 0) !== (b.products.length > 0), { message: "Add a file or a shop product.", path: ["items"] });

export type ManualOrderInput = z.input<typeof manualOrderSchema>;
