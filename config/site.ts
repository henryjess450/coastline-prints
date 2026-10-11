/**
 * Public site settings. Safe to import anywhere, including client components.
 * The pickup address is NOT here on purpose; see config/private.server.ts.
 */
export const site = {
  name: "Coastline Prints",
  shortName: "Coastline Prints",
  /** Brand colour. Also set as --accent in src/app/globals.css. */
  brandColor: "#0e4471",
  tagline: "Custom 3D printing in PLA, PETG and PLA-CF.",
  fulfillmentLabel: "Local pickup",
};

/**
 * What search engines are told about where we are. Only the city and area,
 * never the pickup address (that's sent after payment).
 */
export const seo = {
  /** The live address. Search engines need full URLs. */
  url: (process.env.APP_URL ?? "https://coastlineprints.ca").replace(/\/$/, ""),
  /** Where pickup is, as precise as we say in public. */
  neighbourhood: "Downtown Victoria",
  city: "Victoria",
  region: "BC",
  regionName: "British Columbia",
  /** Areas served, nearest first. "Canada" is shipping. */
  areaServed: ["Downtown Victoria", "Greater Victoria", "Saanich", "Oak Bay", "Esquimalt", "View Royal", "Langford", "Vancouver Island", "Canada"],
  instagram: "https://www.instagram.com/coastline.printz/",
  /** Year the shop opened. */
  founded: "2026",
  /**
   * IndexNow key: tells Bing (which ChatGPT search uses), Yandex and others
   * about changed pages right away. Public on purpose; served from
   * public/<key>.txt. scripts/indexnow.mjs sends the sitemap.
   */
  indexNowKey: "361864c4a1ed200661e42a0413cfdaa6",
};

/**
 * The "how did it go?" email asking for a Google review, sent once per
 * customer a day after their first order is picked up or delivered.
 * Google's rules: never offer anything in return for a review, and don't
 * ask only the happy customers. So everyone gets the same plain ask.
 */
export const reviews = {
  /** From Google Business Profile > "Ask for reviews". GOOGLE_REVIEW_URL="" in .env turns the email off. */
  googleUrl: process.env.GOOGLE_REVIEW_URL ?? "https://g.page/r/CSFjJENuoFu2EAI/review",
  delayHours: 24,
};

export const uploads = {
  /** Per-file limit in MB. Override with NEXT_PUBLIC_MAX_UPLOAD_MB. */
  maxFileMb: Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 100),
  maxFilesPerOrder: 10,
  maxQuantityPerItem: 50,
};

/**
 * Values used on the Terms & Conditions and Privacy Policy pages.
 * Have these reviewed before going live.
 */
export const legal = {
  lastUpdated: "October 11, 2026",
  province: "British Columbia",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "coastline.printz@gmail.com",
  /**
   * A mailing address for news and promotion emails (Canada's anti-spam law
   * asks for one). Use a PO box or business address, never a home address.
   * Left out of the emails until it's set.
   */
  mailingAddress: process.env.MAILING_ADDRESS ?? "",
  /** Days a finished order is held after the "ready for pickup" email. */
  pickupWindowDays: 30,
  /** Days after pickup to report a defect. */
  problemReportDays: 7,
  /** Days uploaded files are kept after an order is picked up. */
  fileRetentionDaysAfterPickup: 90,
  /** Days files from abandoned carts (never paid) are kept. */
  abandonedUploadDays: 30,
  /** Years order and payment records are kept (CRA record-keeping). */
  recordRetentionYears: 6,
};
