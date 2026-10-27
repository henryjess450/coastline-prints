import { z } from "zod";
import { cartItemSchema } from "@/lib/pricing/cart-schema";
import { shopLineSchema } from "@/lib/shop/schema";
import { uploads } from "@config/site";

/**
 * The in-person register (POS). The cashier rings up shop products, one-off
 * custom amounts and uploaded prints; the customer watches the cart on a
 * tablet (a paired display, or the same iPad turned around) and can type an
 * email for their receipt. Payment is taken outside the site (cash,
 * e-Transfer, or the owner's own card reader) and recorded here.
 */

export const POS_BRANDS = [
  { id: "lightlab", name: "LightLab", source: "LightLab market stall" },
  { id: "coastline", name: "Coastline Prints", source: "In person" },
] as const;
export type PosBrand = (typeof POS_BRANDS)[number]["id"];

export const POS_PAYMENTS = [
  { id: "CASH", label: "Cash" },
  { id: "CARD", label: "Card" },
  { id: "ETRANSFER", label: "e-Transfer" },
  { id: "OTHER", label: "Other" },
] as const;
export type PosPayment = (typeof POS_PAYMENTS)[number]["id"];

/** A one-off line rung up by hand, like "Custom keychain $12". */
export const customLineSchema = z.object({
  name: z.string().trim().min(1, "Give the custom item a name.").max(80),
  unitCents: z.number().int().min(0).max(1_000_000),
  quantity: z.number().int().min(1).max(99),
});
export type CustomLine = z.infer<typeof customLineSchema>;

/** What's in the cart. Prints are Coastline only; products come from the brand's own shop. */
export const posCartSchema = z
  .object({
    brand: z.enum(["lightlab", "coastline"]),
    items: z.array(cartItemSchema).max(uploads.maxFilesPerOrder).default([]),
    products: z.array(shopLineSchema).max(40).default([]),
    custom: z.array(customLineSchema).max(40).default([]),
    /** Coupon and gift card codes; gift cards as "number:PIN". */
    codes: z.array(z.string().trim().min(1).max(60)).max(4).default([]),
    /** Only used to check invite codes against the customer. */
    email: z.union([z.literal(""), z.string().trim().toLowerCase().email()]).default(""),
  })
  .refine((c) => c.brand === "coastline" || c.items.length === 0, { message: "Prints are sold as Coastline Prints.", path: ["items"] });

export const posSaleSchema = z.object({
  /** One id per sale, so a double tap can't ring it up twice. */
  attemptId: z.string().uuid(),
  cart: posCartSchema,
  /** The total the cashier saw. If it changed (stock, a gift card used elsewhere), stop and show the new one. */
  expectedTotalCents: z.number().int().min(0),
  payment: z.enum(["CASH", "CARD", "ETRANSFER", "OTHER"]),
  /** Paid through a Square payment link: its payment, checked with Square before the order is made. */
  squarePaymentId: z.string().max(80).nullable().default(null),
  /** Cash handed over, to work out change. */
  tenderedCents: z.number().int().min(0).max(10_000_000).nullable().default(null),
  source: z.string().trim().min(2).max(60),
  customer: z.object({
    name: z.string().trim().max(100).default(""),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().email("That email doesn't look right.").max(200)]).default(""),
    phone: z.string().trim().max(30).default(""),
    notes: z.string().trim().max(1000).default(""),
  }),
  /** They walk away with it (marks the order picked up). Off for prints that still need printing. */
  handedOver: z.boolean().default(true),
  printTicket: z.boolean().default(false),
  emailCustomer: z.boolean().default(true),
  /** The paired display, to show the thank-you screen. */
  registerId: z.string().max(40).nullable().default(null),
});

export type PosCartInput = z.input<typeof posCartSchema>;
export type PosSaleInput = z.input<typeof posSaleSchema>;

/** One line as the register and the customer see it. */
export type PosLineView = {
  key: string;
  name: string;
  detail?: string;
  quantity: number;
  cents: number | null;
  error?: string;
  kind: "product" | "print" | "custom";
  /** Product photo. */
  image?: string;
  /** Prints: the filament colour. */
  swatch?: string;
};

/** The server's price for a cart. */
export type PosQuote = {
  ok: boolean;
  error?: string;
  lines: PosLineView[];
  /** Order fee and minimum top-up (prints only). */
  fees: { label: string; cents: number }[];
  discounts: { label: string; cents: number }[];
  /** Codes that couldn't be used, and why. */
  rejected: { code: string; reason: string }[];
  totalCents: number;
};

/**
 * Something the cashier puts in front of the customer, over whatever the
 * display is showing. Each has an id so the customer's answer can be matched.
 */
export type PosPopup =
  /** Their email, for the receipt. */
  | { id: string; kind: "email" }
  /** Join Coastline Rewards: makes an account and emails them how to sign in. */
  | { id: string; kind: "account" }
  /** A Square payment link to scan and pay on their phone. */
  | { id: string; kind: "card-link"; url: string; amountCents: number; paid?: boolean }
  /** Where to send an e-Transfer. */
  | { id: string; kind: "etransfer"; sendTo: string; amountCents: number; message: string }
  /** A link to scan: Instagram, a Google review... */
  | { id: string; kind: "qr"; title: string; text?: string; url: string }
  /** A note typed by the cashier. */
  | { id: string; kind: "message"; title: string; text?: string };

/** The customer's answer to a popup, picked up by the register. */
export type PosReply = { popupId: string; kind: "email" | "account" | "dismiss"; email?: string; name?: string; created?: boolean; at: number };

/** What the customer display shows. Pushed by the cashier, a few times a second at most. */
export type PosScreen = {
  stage: "idle" | "cart" | "done";
  brand?: PosBrand;
  lines?: PosLineView[];
  fees?: { label: string; cents: number }[];
  discounts?: { label: string; cents: number }[];
  totalCents?: number;
  /** How they're paying, and cash given (for the change). */
  payment?: PosPayment | "LINK" | null;
  tenderedCents?: number | null;
  /** The email their receipt goes to. */
  email?: string;
  /** Done stage. */
  orderNumber?: string;
  emailed?: boolean;
  popup?: PosPopup | null;
};

/** "4KX7Q2": no 0/O or 1/I, easy to read across a table. */
export const PAIR_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const PAIR_LENGTH = 6;
export const normalizePairCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, PAIR_LENGTH);
