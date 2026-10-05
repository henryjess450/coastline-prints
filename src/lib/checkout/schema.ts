import { z } from "zod";
import { cartItemSchema } from "@/lib/pricing/cart-schema";
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
  pickupAcknowledged: z.literal(true, { message: "Please confirm you'll pick up your order." }),
  termsAccepted: z.literal(true, { message: "Please accept the Terms & Conditions." }),
});

export const checkoutRequestSchema = z.object({
  /** One id per "Pay" press. Reused on network retries so the card is never charged twice. */
  attemptId: z.string().uuid(),
  /** Square card/wallet token. Empty only when gift cards cover the whole order. */
  sourceId: z.string().max(500).default(""),
  /** Coupon and gift card codes the customer added. */
  codes: z.array(z.string().trim().min(1).max(40)).max(4).default([]),
  customer: customerSchema,
  /** Chosen pickup slot. Re-checked against the schedule on the server. */
  pickup: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/) }),
  items: z.array(cartItemSchema).min(1).max(uploads.maxFilesPerOrder),
  /** The total the customer saw. If the server's price differs, we stop and show the new price. */
  expectedTotalCents: z.number().int().nonnegative(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
