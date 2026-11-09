/**
 * The card processing fee added when someone pays through a Square payment
 * link (the register's "Scan to pay" and the kiosk), so the shop isn't out of
 * pocket for Square's cut. Shown to the customer as its own line with why.
 * Safe to import anywhere.
 */
export type CardFeeSettings = { on: boolean; percent: number; fixedCents: number };

export const CARD_FEE_DEFAULTS: CardFeeSettings = { on: false, percent: 2.9, fixedCents: 30 };
export const CARD_FEE_KEY = "card-fee";
export const CARD_FEE_LINE = "card-fee";
export const CARD_FEE_NAME = "Card processing fee";

/** What the fee has to be so that after Square takes its cut of the whole total, the shop still gets `cents`. */
export function cardFeeFor(cents: number, s: Pick<CardFeeSettings, "percent" | "fixedCents">) {
  if (cents <= 0) return 0;
  const gross = Math.ceil((cents + s.fixedCents) / (1 - s.percent / 100));
  return Math.max(0, gross - cents);
}

/** "Square charges 2.9% + 30¢ for card and phone payments", for the line's explanation. */
export function cardFeeWhy(s: Pick<CardFeeSettings, "percent" | "fixedCents">) {
  const parts = [s.percent ? `${s.percent}%` : "", s.fixedCents ? `${s.fixedCents}¢` : ""].filter(Boolean).join(" + ");
  return `Square charges us ${parts || "a fee"} on card and phone payments. This covers it.`;
}
