/**
 * Pricing engine. Pure functions shared by the browser (instant estimate) and
 * the server (authoritative price). Money is integer CAD cents.
 */
import type { MaterialId } from "@config/materials";
import type { AppConfig } from "@/lib/config/types";
import { assignPrinter, ORIENTATIONS, type PrinterAssignment } from "@/lib/printers/fit";
import { estimateChanges } from "@/lib/model/swaps";
import { upDirection, type SupportProfile } from "@/lib/model/supports";
import type { ColorProfile } from "@/lib/model/threemf";
import type { MaterialConfig } from "@config/materials";
import { quoteShipping, type ShippingQuote } from "@/lib/shipping/pack";
import type { Vec3 } from "@/lib/stl/analyze";
import type { ColorMap } from "@/lib/model/colors";

export type ItemSpec = {
  /** Printed size in mm (already scaled, before orientation). */
  size: Vec3;
  /** Enclosed volume of the scaled model, mm³. */
  volumeMm3: number;
  /** Surface area of the scaled model, mm². */
  surfaceAreaMm2: number;
  material: MaterialId;
  /** Single colour, or the most-used colour of a multicolour print. */
  colorId: string;
  /** Multicolour: file filament number → stock colour id. Null/absent = one colour. */
  colorMap?: ColorMap | null;
  /** Share of the surface each file filament covers (from the file). */
  colorShares?: Record<number, number>;
  /** Which file filaments appear at each height (for counting colour changes). */
  colorProfile?: ColorProfile;
  /** Overhangs needing support for each way up, in file units (from the upload). */
  supportProfile?: SupportProfile | null;
  /** File units → printed mm on each original axis (unit fix × customer scale), for scaling supports. */
  scale?: Vec3;
  quality: string;
  infill: string;
  quantity: number;
};

export type ItemQuote =
  | {
      ok: true;
      assignment: Extract<PrinterAssignment, { ok: true }>;
      /** Filament per piece, including any multicolour flushing and prime tower. */
      gramsEach: number;
      /** Print hours per piece, including any filament changes. */
      hoursEach: number;
      /** Tree supports, per piece (already in gramsEach and hoursEach). */
      supportGramsEach: number;
      /** Multicolour only: what the colour changes add, per piece. */
      multicolor?: { colors: number; changes: number; wasteGramsEach: number; changeHoursEach: number; amsFeeCents: number };
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
  /** Pickup total: prints, fees and minimum top-up. Shipping is added on top when chosen. */
  totalCents: number;
  /** False if any item can't be printed; checkout must be blocked. */
  ok: boolean;
  /** Flat rate boxes for this order, or why it can't ship. Null until every item prices. */
  shipping: ShippingQuote | null;
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
  const multi = spec.colorMap && Object.keys(spec.colorMap).length > 1 ? spec.colorMap : null;
  let perGramMix: number | null = null;
  let distinct = 1;
  if (multi) {
    const picked = Object.entries(multi).map(([n, id]) => ({ share: spec.colorShares?.[Number(n)] ?? 1, color: material.colors.find((c) => c.id === id && c.available) }));
    if (picked.some((p) => !p.color)) return { ok: false, assignment: null, error: "One of your colours isn't available. Please pick another." };
    distinct = new Set(Object.values(multi)).size;
    const most = Math.max(...cfg.printers.filter((p) => p.materials.includes(spec.material)).map((p) => p.maxColors ?? 1));
    if (distinct > most) return { ok: false, assignment: null, error: `We can print up to ${most} colours in one piece. Pick the same colour for some parts of the model.` };
    const total = picked.reduce((s, p) => s + p.share, 0) || 1;
    perGramMix = picked.reduce((s, p) => s + (p.share / total) * (p.color!.pricePerGramCents ?? cfg.pricing.pricePerGramCents), 0);
  }
  const quality = cfg.qualityPresets.find((q) => q.id === spec.quality);
  const infill = cfg.infillPresets.find((i) => i.id === spec.infill);
  if (!quality || !infill) return { ok: false, assignment: null, error: "Unknown print setting." };
  if (!(spec.volumeMm3 > 0)) return { ok: false, assignment: null, error: "This model has no volume, so it can't be priced." };

  // Multicolour prints only go to printers with a colour unit that has enough slots.
  const fleet = distinct > 1 ? cfg.printers.filter((p) => (p.maxColors ?? 1) >= distinct) : cfg.printers;
  const assignment = assignPrinter(spec.size, spec.material, fleet, cfg.safetyMarginMm);
  if (!assignment.ok) return { ok: false, assignment, error: assignment.message };

  const qty = spec.quantity;
  const modelGrams = estimateGrams(spec.volumeMm3, spec.surfaceAreaMm2, material.densityGPerCm3, infill.infillFraction, cfg.estimation.wallThicknessMm);
  const changes = multi && distinct > 1 ? colorChanges(spec, multi, assignment, quality.layerHeightMm, material, cfg) : null;
  const wasteGrams = changes ? ((changes.flushMm3 + changes.towerMm3) / 1000) * material.densityGPerCm3 : 0;
  const supportGrams = supportGramsFor(spec, assignment.orientation, material.densityGPerCm3, cfg);
  const gramsEach = modelGrams + wasteGrams + supportGrams;
  // The prime tower prints like the model; flushing is part of the change time; supports print slower.
  const towerGrams = changes ? (changes.towerMm3 / 1000) * material.densityGPerCm3 : 0;
  const supportHours = estimateHours(supportGrams, quality.gramsPerHour, assignment.printer.speedFactor * cfg.supports.speedFactor);
  const hoursEach = estimateHours(modelGrams + towerGrams, quality.gramsPerHour, assignment.printer.speedFactor) + supportHours + (changes?.hours ?? 0);
  const hoursTotal = hoursEach * qty + cfg.estimation.setupHours;

  // One piece has to finish within the time limit (copies print one after another, so they don't count).
  const maxHours = cfg.estimation.maxHoursPerPiece;
  const pieceHours = hoursEach + cfg.estimation.setupHours;
  if (pieceHours > maxHours) {
    // Colour changes scale with the number of layers, so with size.
    const hoursAt = (s: number) =>
      estimateHours(estimateGrams(spec.volumeMm3 * s ** 3, spec.surfaceAreaMm2 * s ** 2, material.densityGPerCm3, infill.infillFraction, cfg.estimation.wallThicknessMm), quality.gramsPerHour, assignment.printer.speedFactor) +
      (changes?.hours ?? 0) * s +
      supportHours * s ** 3 +
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

  const perGram = perGramMix ?? color.pricePerGramCents ?? cfg.pricing.pricePerGramCents;
  const filamentCents = Math.round(gramsEach * qty * perGram);
  const machineCents = Math.round(hoursTotal * cfg.pricing.pricePerHourCents);
  const markupCents = cfg.pricing.markupPerPieceCents * qty;
  // Once per multicolour item, for loading the colour unit.
  const amsFeeCents = changes ? cfg.multicolor.amsFeeCents : 0;
  const lineCents = filamentCents + machineCents + markupCents + amsFeeCents;

  return {
    ok: true,
    assignment,
    gramsEach,
    hoursEach,
    supportGramsEach: supportGrams,
    ...(changes ? { multicolor: { colors: distinct, changes: changes.changes, wasteGramsEach: wasteGrams, changeHoursEach: changes.hours, amsFeeCents } } : {}),
    hoursTotal,
    filamentCents,
    machineCents,
    markupCents,
    lineCents,
    unitCents: Math.round(lineCents / qty),
  };
}

/**
 * Tree supports for one piece: the space under the overhangs (scaled to the
 * printed size) times how much of it tree supports fill, plus the denser
 * layers where they touch the model.
 */
function supportGramsFor(spec: ItemSpec, orientation: number, density: number, cfg: AppConfig) {
  const dir = cfg.supports.enabled ? spec.supportProfile?.dirs[orientation] : undefined;
  if (!dir) return 0;
  const s = spec.scale ?? { x: 1, y: 1, z: 1 };
  const k = [s.x, s.y, s.z];
  const { axis } = upDirection(orientation);
  const volume = dir.volumeMm3 * k[0] * k[1] * k[2];
  const area = dir.areaMm2 * k[(axis + 1) % 3] * k[(axis + 2) % 3];
  const mm3 = volume * cfg.supports.treeFill + area * cfg.supports.interfaceMm * cfg.supports.interfaceFill;
  return (mm3 / 1000) * density;
}

/**
 * Colour changes for one piece, sliced along whichever original axis ends up
 * vertical. Without a colour profile (older uploads) it assumes every layer
 * uses every colour, which can only overestimate.
 */
function colorChanges(spec: ItemSpec, map: ColorMap, assignment: Extract<PrinterAssignment, { ok: true }>, layerHeightMm: number, material: MaterialConfig, cfg: AppConfig) {
  const hexOf = (id: string) => material.colors.find((c) => c.id === id)?.hex ?? "#888888";
  const every = Object.keys(map).reduce((m, n) => m | (2 ** Number(n)), 0);
  const profile: ColorProfile = spec.colorProfile ?? { bins: 1, axes: [[every], [every], [every]] };
  const upAxis = spec.colorProfile ? ORIENTATIONS[assignment.orientation][2] : 2;
  return estimateChanges({ profile, upAxis, heightMm: assignment.orientedSize.z, layerHeightMm, colorOf: (n) => map[n], hexOf, cfg: cfg.multicolor });
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
  const shipping = ok
    ? quoteShipping(
        specs.flatMap((s, i) => {
          const q = items[i];
          return q.ok ? Array.from({ length: s.quantity }, () => ({ sizeMm: s.size, grams: q.gramsEach })) : [];
        }),
        cfg.shipping,
      )
    : null;
  return { items, baseFeeCents, subtotalCents, minimumAdjCents, totalCents: raw + minimumAdjCents, ok, shipping };
}
