/**
 * Pricing and estimation defaults. All money is CAD cents.
 * Rates may be fractional cents; totals are rounded to whole cents per line.
 * The admin settings page can override any of these.
 *
 * Order total = baseFee (once per order)
 *             + for each item: (grams × perGram + hours × perHour + markup) × quantity
 *             raised to minimumOrder if below it.
 */
export const CURRENCY = "CAD" as const;

export const pricing = {
  baseFeeCents: 750,
  /** $30 per 1 kg spool → 3¢ per gram. */
  pricePerGramCents: 3,
  /** Machine time: covers power, wear and maintenance. */
  pricePerHourCents: 100,
  /** Flat markup added to every printed piece. */
  markupPerPieceCents: 50,
  minimumOrderCents: 750,
};

/** Layer-height presets. gramsPerHour is the reference print speed (speedFactor 1.0). */
export const qualityPresets = [
  { id: "draft", name: "Draft", layerHeightMm: 0.28, gramsPerHour: 30, description: "Fastest. Visible layers, fine for prototypes." },
  { id: "standard", name: "Standard", layerHeightMm: 0.2, gramsPerHour: 22, description: "Balanced detail and speed." },
  { id: "fine", name: "Fine", layerHeightMm: 0.12, gramsPerHour: 12, description: "Smoothest surfaces, slowest." },
] as const;

/** Infill presets. Walls/top/bottom are modelled as a solid shell of wallThicknessMm. */
export const infillPresets = [
  { id: "light", name: "Light", infillFraction: 0.1, description: "Decor and display pieces." },
  { id: "standard", name: "Standard", infillFraction: 0.15, description: "Good for most prints." },
  { id: "strong", name: "Strong", infillFraction: 0.35, description: "Functional parts that take a load." },
  { id: "solid", name: "Solid", infillFraction: 1, description: "Maximum strength and weight." },
] as const;

export const estimation = {
  /** Effective solid shell (walls + top/bottom skins). */
  wallThicknessMm: 1.2,
  /** Per-print overhead: heating, levelling, purge (hours, added once per plate). */
  setupHours: 0.15,
  /**
   * Longest single print we take, in hours (one piece, setup included). The
   * printers can't be babysat overnight, so anything longer can't be ordered.
   */
  maxHoursPerPiece: 12,
};

export type QualityId = (typeof qualityPresets)[number]["id"];
export type InfillId = (typeof infillPresets)[number]["id"];
