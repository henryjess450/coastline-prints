/**
 * Seasonal promotions. The gift card bonus here is the default; the admin
 * Promote page can change it or switch it off (saved in the database).
 */

/** "Spend at least minCents on a gift card, the card gets bonusCents extra", between two shop days (inclusive). */
export type GiftBonus = { on: boolean; name: string; minCents: number; bonusCents: number; startsOn: string; endsOn: string };

export const defaultGiftBonus: GiftBonus = {
  on: true,
  name: "Holiday bonus",
  minCents: 5000,
  bonusCents: 500,
  startsOn: "2026-11-01",
  endsOn: "2026-12-24",
};

/** The Christmas gifts page. Check these against Canada Post's holiday dates each year. */
export const holiday = {
  year: 2026,
  /** Last day to order a print for pickup before Christmas (5 days before Dec 24). */
  orderForPickupBy: "2026-12-19",
  /** Last day to order a print to be shipped before Christmas. A guess; Canada Post posts its own dates in November. */
  orderForShippingBy: "2026-12-10",
};
