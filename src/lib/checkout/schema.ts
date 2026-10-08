import { z } from "zod";
import { cartItemSchema } from "@/lib/pricing/cart-schema";
import { shipping } from "@config/shipping";
import { uploads } from "@config/site";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s().-]{10,20}$/, "Please enter a valid phone number.")
    .refine((p) => p.replace(/\D/g, "").length >= 10, "Please enter a valid phone number."),
  notes: z.string().trim().max(1000).optional().default(""),
  /** Required for pickup orders only (checked with the delivery choice). */
  pickupAcknowledged: z.boolean().optional().default(false),
  termsAccepted: z.literal(true, { message: "Please accept the Terms & Conditions." }),
});

const PROVINCES = shipping.provinces.map((p) => p.code) as [string, ...string[]];

/** "k1a0b1" → "K1A 0B1" */
export function normalizePostal(raw: string) {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : raw.trim().toUpperCase();
}

export const addressSchema = z.object({
  name: z.string().trim().min(2, "Please enter who it's going to.").max(100),
  line1: z.string().trim().min(3, "Please enter a street address.").max(120),
  line2: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(2, "Please enter a city.").max(60),
  province: z.enum(PROVINCES, { message: "Please choose a province or territory." }),
  postal: z
    .string()
    .transform(normalizePostal)
    .pipe(z.string().regex(/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] \d[ABCEGHJ-NPRSTV-Z]\d$/, "Please enter a valid Canadian postal code.")),
});

export const fulfillmentSchema = z.discriminatedUnion("method", [
  /** Chosen pickup slot. Re-checked against the schedule on the server. */
  z.object({ method: z.literal("pickup"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/) }),
  /** option: "mailer" (Lettermail, untracked), "parcel" (mailer as a tracked parcel) or "box" (tracked flat rate box). */
  z.object({ method: z.literal("ship"), option: z.enum(["mailer", "parcel", "box"]), address: addressSchema }),
]);

export const checkoutRequestSchema = z.object({
  /** One id per "Pay" press. Reused on network retries so the card is never charged twice. */
  attemptId: z.string().uuid(),
  /** card (Square) or etransfer (Interac, confirmed when the deposit email arrives). */
  payment: z.enum(["card", "etransfer"]).default("card"),
  /** Square card/wallet token. Empty only when gift cards cover the whole order. */
  sourceId: z.string().max(500).default(""),
  /** Coupon and gift card codes the customer added. */
  codes: z.array(z.string().trim().min(1).max(40)).max(4).default([]),
  customer: customerSchema,
  fulfillment: fulfillmentSchema,
  items: z.array(cartItemSchema).min(1).max(uploads.maxFilesPerOrder),
  /** The total the customer saw. If the server's price differs, we stop and show the new price. */
  expectedTotalCents: z.number().int().nonnegative(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
