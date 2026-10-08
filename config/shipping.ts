/**
 * Shipping with Canada Post: bubble mailers (Lettermail) for small flat orders,
 * flat rate boxes for everything else. Both cost the same to anywhere in
 * Canada, so the shop's address never goes into the math (and is never shown).
 * Prices and sizes from canadapost-postescanada.ca, checked October 2026.
 * Update them here when Canada Post changes them.
 */
export const shipping = {
  /** Set to false to turn shipping off and go back to pickup only. */
  enabled: true,
  /** Added to every box for bubble wrap, tape and packing time. */
  packingFeePerBoxCents: 200,
  /**
   * Space kept clear on every side of each print for padding, in mm. Prints
   * are packed as their size plus this on every side. Raise it if boxes
   * come out too tight; lower it to fit more in smaller boxes.
   */
  paddingMm: 5,
  /** Weight of an empty box plus wrap, counted against the box's weight limit. */
  packagingGrams: 250,
  /** Canada Post's limit for every flat rate box. */
  maxGramsPerBox: 5000,
  /** Cheapest first. Sizes in mm. */
  boxes: [
    { id: "xs", name: "Extra Small", sizeMm: [225, 155, 76], priceCents: 1899 },
    { id: "s", name: "Small", sizeMm: [320, 240, 80], priceCents: 2199 },
    { id: "m", name: "Medium", sizeMm: [379, 260, 120], priceCents: 2499 },
    { id: "l", name: "Large", sizeMm: [403, 298, 187], priceCents: 3299 },
  ],
  /**
   * Small, flat orders go in a padded bubble mailer as Oversized Lettermail:
   * one price anywhere in Canada by weight, but no tracking or coverage, so
   * customers can still pick a tracked box instead. Lettermail allows up to
   * 380 × 270 mm, 20 mm thick and 500 g, mailer included.
   */
  mailer: {
    enabled: true,
    /**
     * Usable space for prints inside the mailer (the bubbles are the padding).
     * Thickness: Canada Post takes anything up to 10 mm as regular Lettermail
     * even if it's rigid; thicker rigid items cost more or get refused. 6 mm
     * of print plus about 4 mm of mailer keeps it regular.
     */
    sizeMm: [330, 220, 6],
    /** The empty mailer, counted toward the weight bands. */
    packagingGrams: 25,
    packingFeeCents: 200,
    /**
     * Thicker than Lettermail allows (or for tracking), a mailer can go as a
     * small parcel. Parcels are priced by distance, so this uses live Canada
     * Post rates from the shop's postal code (CANADA_POST_* in .env; the
     * option is hidden until those are set).
     */
    parcel: {
      enabled: true,
      /** Thickest print that still goes in a mailer rather than a box. */
      maxThicknessMm: 50,
      /** Outside size of the mailer, for the rate request. */
      outerMm: [360, 250],
      /** Canada Post service to buy: Regular Parcel (tracked, the cheapest). */
      service: "DOM.RP",
    },
    /** Oversized Lettermail, from canadapost-postescanada.ca, checked October 2026. */
    rates: [
      { upToGrams: 100, priceCents: 261 },
      { upToGrams: 200, priceCents: 429 },
      { upToGrams: 300, priceCents: 598 },
      { upToGrams: 400, priceCents: 685 },
      { upToGrams: 500, priceCents: 736 },
    ],
  },
  /**
   * Tax on postage. Canada Post charges tax by where it's mailed from: in BC
   * that's GST only (never PST). With Canada Post API keys set, the rate is
   * read live from Canada Post every 12 hours, so it follows any change
   * (including HST). This is the fallback when it can't be read.
   * The packing fee is not taxed.
   */
  tax: { rate: 0.05, label: "GST" },
  /** Flat rate boxes and Lettermail only go to Canadian addresses. */
  provinces: [
    { code: "AB", name: "Alberta" },
    { code: "BC", name: "British Columbia" },
    { code: "MB", name: "Manitoba" },
    { code: "NB", name: "New Brunswick" },
    { code: "NL", name: "Newfoundland and Labrador" },
    { code: "NS", name: "Nova Scotia" },
    { code: "NT", name: "Northwest Territories" },
    { code: "NU", name: "Nunavut" },
    { code: "ON", name: "Ontario" },
    { code: "PE", name: "Prince Edward Island" },
    { code: "QC", name: "Quebec" },
    { code: "SK", name: "Saskatchewan" },
    { code: "YT", name: "Yukon" },
  ],
};

export type ShippingConfig = typeof shipping;
export type ShippingBox = ShippingConfig["boxes"][number];
