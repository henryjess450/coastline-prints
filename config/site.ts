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
  lastUpdated: "October 7, 2026",
  province: "British Columbia",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "coastline.printz@gmail.com",
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
