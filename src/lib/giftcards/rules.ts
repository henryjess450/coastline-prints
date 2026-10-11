/**
 * Gift card purchase rules, shared by the form (instant feedback) and the
 * server (the real check). Dates are "YYYY-MM-DD" in the shop's time zone.
 */
import { z } from "zod";
import { GIFT_DESIGNS } from "./designs";
import { pickup } from "@config/pickup";
import { addDays, atShopHour, todayIn } from "@/lib/pickup";

export const GIFT_PRESETS_CENTS = [2500, 5000, 7500, 10000];
export const GIFT_MIN_CENTS = 1000;
export const GIFT_MAX_CENTS = 50000;
export const GIFT_MESSAGE_MAX = 300;
/** Scheduled gifts arrive at this hour, shop time, on the chosen day. */
export const GIFT_SEND_HOUR = 9;
export const GIFT_SCHEDULE_MAX_DAYS = 365;

const email = z.string().trim().toLowerCase().email("Please enter a valid email address.").max(200);
const name = (what: string) => z.string().trim().min(1, `Please enter ${what}.`).max(80);

export const giftDetailsSchema = z.object({
  /** The card's look, which also sets where it can be spent (designs.ts). */
  design: z.enum(GIFT_DESIGNS).optional().default("coastline"),
  amountCents: z
    .number()
    .int()
    .min(GIFT_MIN_CENTS, `Gift cards start at $${GIFT_MIN_CENTS / 100}.`)
    .max(GIFT_MAX_CENTS, `Gift cards go up to $${GIFT_MAX_CENTS / 100}.`),
  recipientName: name("their name"),
  recipientEmail: email,
  message: z.string().trim().max(GIFT_MESSAGE_MAX, `Messages can be up to ${GIFT_MESSAGE_MAX} characters.`).optional().default(""),
  buyerName: name("your name"),
  buyerEmail: email,
  /** null = send straight after payment. */
  sendOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});
export type GiftDetails = z.infer<typeof giftDetailsSchema>;

export const giftRequestSchema = giftDetailsSchema.extend({
  attemptId: z.string().uuid(),
  sourceId: z.string().min(1).max(500),
  expectedTotalCents: z.number().int(),
  /** The bonus the page showed, so a promotion ending mid-checkout is caught. */
  expectedBonusCents: z.number().int().min(0).optional().default(0),
});

/** The earliest and latest days a gift can be scheduled for. */
export function scheduleRange(now = new Date()) {
  const today = todayIn(pickup.timeZone, now);
  return { min: addDays(today, 1), max: addDays(today, GIFT_SCHEDULE_MAX_DAYS) };
}

export function isValidSendOn(sendOn: string | null, now = new Date()) {
  if (sendOn == null) return true;
  const { min, max } = scheduleRange(now);
  return sendOn >= min && sendOn <= max;
}

/**
 * The moment a gift goes out: right away, or 9 am shop time on sendOn
 * (daylight saving handled by asking the time zone for its offset).
 */
export function deliverAtFor(sendOn: string | null, now = new Date(), timeZone = pickup.timeZone) {
  if (!sendOn) return now;
  return atShopHour(sendOn, GIFT_SEND_HOUR, timeZone);
}

/** "Saturday, October 10" */
export function friendlyDate(sendOn: string) {
  const [y, m, d] = sendOn.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}
