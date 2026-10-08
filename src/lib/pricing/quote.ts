/**
 * Pricing engine. Pure functions shared by the browser (instant estimate) and
 * the server (authoritative price). Money is integer CAD cents.
 */
import type { MaterialId } from "@config/materials";
import type { AppConfig } from "@/lib/config/types";
import { assignPrinter, type PrinterAssignment } from "@/lib/printers/fit";
import type { Vec3 } from "@/lib/stl/analyze";

export type ItemSpec = {
  /** Printed size in mm (already scaled, before orientation). */
  size: Vec3;
  /** Enclosed volume of the scaled model, mm³. */
  volumeMm3: number;
  /** Surface area of the scaled model, mm². */
  surfaceAreaMm2: number;
  material: MaterialId;
  colorId: string;
  quality: string;
  infill: string;
  quantity: number;
};

export type ItemQuote =
  | {
      ok: true;
      assignment: Extract<PrinterAssignment, { ok: true }>;
      gramsEach: number;
      hoursEach: number;
      /** Print hours for the whole line (pieces + one setup). */
      hoursTotal: number;
      filamentCents: number;
      machineCents: number;
      markupCents: number;
      lineCents: number;
      unitCents: number;
    }
  | {
      ok: false;
      assignment: PrinterAssignment | null;
      error: string;
      /** Set when one piece would print for longer than we allow. */
      tooLong?: { hours: number; maxHours: number; fitPercent: number | null };
    };

export type OrderQuote = {
  items: ItemQuote[];
  baseFeeCents: number;
  subtotalCents: number;
  minimumAdjCents: number;
  totalCents: number;
  /** False if any item can't be printed; checkout must be blocked. */
  ok: boolean;
};

/**
 * Estimated grams of filament for one piece. Walls and top/bottom skins are a
 * solid shell (surface area × wall thickness, capped at the full volume); the
 * inside is filled at the infill fraction.
 */
export function estimateGrams(volumeMm3: number, surfaceAreaMm2: number, density: number, infillFraction: number, wallThicknessMm: number) {
  const shell = Math.min(volumeMm3, surfaceAreaMm2 * wallThicknessMm);
  const printed = shell + (volumeMm3 - shell) * infillFraction;
  return (printed / 1000) * density; // mm³ → cm³ × g/cm³
}

/** Estimated print hours for one piece (no setup). */
export function estimateHours(grams: number, gramsPerHour: number, speedFactor: number) {
  return grams / (gramsPerHour * speedFactor);
}

export function quoteItem(spec: ItemSpec, cfg: AppConfig): ItemQuote {
  const material = cfg.materials.find((m) => m.id === spec.material);
  if (!material) return { ok: false, assignment: null, error: "Unknown material." };
  const color = material.colors.find((c) => c.id === spec.colorId && c.available);
  if (!color) return { ok: false, assignment: null, error: "That colour isn't available. Please pick another." };
  const quality = cfg.qualityPresets.find((q) => q.id === spec.quality);
  const infill = cfg.infillPresets.find((i) => i.id === spec.infill);
  if (!quality || !infill) return { ok: false, assignment: null, error: "Unknown print setting." };
  if (!(spec.volumeMm3 > 0)) return { ok: false, assignment: null, error: "This model has no volume, so it can't be priced." };

  const assignment = assignPrinter(spec.size, spec.material, cfg.printers, cfg.safetyMarginMm);
  if (!assignment.ok) return { ok: false, assignment, error: assignment.message };

  const qty = spec.quantity;
  const gramsEach = estimateGrams(spec.volumeMm3, spec.surfaceAreaMm2, material.densityGPerCm3, infill.infillFraction, cfg.estimation.wallThicknessMm);
  const hoursEach = estimateHours(gramsEach, quality.gramsPerHour, assignment.printer.speedFactor);
  const hoursTotal = hoursEach * qty + cfg.estimation.setupHours;

  // One piece has to finish within the time limit (copies print one after another, so they don't count).
  const maxHours = cfg.estimation.maxHoursPerPiece;
  const pieceHours = hoursEach + cfg.estimation.setupHours;
  if (pieceHours > maxHours) {
    const hoursAt = (s: number) =>
      estimateHours(estimateGrams(spec.volumeMm3 * s ** 3, spec.surfaceAreaMm2 * s ** 2, material.densityGPerCm3, infill.infillFraction, cfg.estimation.wallThicknessMm), quality.gramsPerHour, assignment.printer.speedFactor) +
      cfg.estimation.setupHours;
    const fitPercent = largestFit(hoursAt, maxHours);
    const about = Math.round(pieceHours);
    return {
      ok: false,
      assignment,
      tooLong: { hours: pieceHours, maxHours, fitPercent },
      error:
        `This would take about ${about} hours to print, and we can only take prints under ${maxHours} hours. ` +
        (fitPercent ? `Try ${fitPercent}% of this size or smaller, or a lighter infill or faster quality.` : "Try a smaller size, a lighter infill or a faster quality."),
    };
  }

  const perGram = color.pricePerGramCents ?? cfg.pricing.pricePerGramCents;
  const filamentCents = Math.round(gramsEach * qty * perGram);
  const machineCents = Math.round(hoursTotal * cfg.pricing.pricePerHourCents);
  const markupCents = cfg.pricing.markupPerPieceCents * qty;
  const lineCents = filamentCents + machineCents + markupCents;

  return {
    ok: true,
    assignment,
    gramsEach,
    hoursEach,
    hoursTotal,
    filamentCents,
    machineCents,
    markupCents,
    lineCents,
    unitCents: Math.round(lineCents / qty),
  };
}

/** The biggest whole-percent size (of the current one) that prints within the limit, or null. */
function largestFit(hoursAt: (scale: number) => number, maxHours: number) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (hoursAt(mid) <= maxHours) lo = mid;
    else hi = mid;
  }
  const pct = Math.floor(lo * 100);
  return pct >= 5 ? pct : null;
}

export function quoteOrder(specs: ItemSpec[], cfg: AppConfig): OrderQuote {
  const items = specs.map((s) => quoteItem(s, cfg));
  const ok = items.length > 0 && items.every((i) => i.ok);
  const subtotalCents = items.reduce((sum, i) => sum + (i.ok ? i.lineCents : 0), 0);
  const baseFeeCents = cfg.pricing.baseFeeCents;
  const raw = baseFeeCents + subtotalCents;
  const minimumAdjCents = Math.max(0, cfg.pricing.minimumOrderCents - raw);
  return { items, baseFeeCents, subtotalCents, minimumAdjCents, totalCents: raw + minimumAdjCents, ok };
}
