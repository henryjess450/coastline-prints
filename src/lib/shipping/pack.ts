/**
 * Works out how an order can ship. Pure, so the checkout preview and the
 * server charge exactly the same shipping.
 *
 * Small flat orders get a bubble mailer (Lettermail, no tracking) as the
 * default, with tracked flat rate boxes offered as the upgrade. Everything
 * else ships in boxes.
 *
 * Each print is treated as its bounding box plus padding, laid flat, and
 * packed in rows and layers. That's a real arrangement, so if it fits here it
 * fits in the box (odd shapes often leave room to spare).
 *
 * Boxes:
 * 1. Every piece must fit some box on its own and be under the weight limit.
 * 2. Fill Large boxes one after another until every piece is packed.
 * 3. Swap each box for the cheapest size its contents still fit in.
 */
import type { ShippingConfig } from "@config/shipping";

export type ShipPiece = { sizeMm: { x: number; y: number; z: number }; grams: number };

export type ShippingMethod = "mailer" | "parcel" | "box";

export type ShippingOption = {
  method: ShippingMethod;
  tracked: boolean;
  /** One row per package, so the owner knows how many pieces go in each. */
  boxes: { id: string; name: string; priceCents: number; pieces: number }[];
  /** Canada Post's price, before tax. */
  postageCents: number;
  /** Tax Canada Post charges on the postage (GST in BC). */
  taxCents: number;
  /** "GST" or "HST" */
  taxLabel: string;
  packingCents: number;
  totalCents: number;
};

/** A bubble mailer sent as a parcel: what Canada Post needs to price it. */
export type ParcelMailer = { grams: number; sizeMm: [number, number, number]; pieces: number };

/**
 * options[0] is the default (the cheapest). `parcel` is set when the order
 * also fits a mailer sent as a parcel; its price needs the destination, so
 * the server adds that option once the customer enters a postal code.
 */
export type ShippingQuote = { ok: true; options: ShippingOption[]; parcel: ParcelMailer | null } | { ok: false; reason: string };

export const MAILER_ID = "mailer";
export const PARCEL_MAILER_ID = "parcel-mailer";

/** A padded piece laid flat: long side, short side, height (long ≥ short ≥ height). */
type Piece = { l: number; w: number; h: number; grams: number };
type Box = ShippingConfig["boxes"][number] & { l: number; w: number; h: number };

/** Pieces are packed one by one, so an absurd quantity is refused rather than looped over. */
const MAX_PIECES = 1000;

const flat = (d: number[]) => {
  const [l, w, h] = [...d].sort((a, b) => b - a);
  return { l, w, h };
};

/**
 * Packs as many pieces as it can into one box, tallest first: layers stacked
 * up the box, each filled with rows across it. Returns the indexes packed.
 */
export function packOne(pieces: Piece[], box: { l: number; w: number; h: number }, maxGrams: number): number[] {
  const order = pieces.map((_, i) => i).sort((a, b) => pieces[b].h - pieces[a].h || pieces[b].l - pieces[a].l);
  const left = new Set(order);
  const packed: number[] = [];
  let grams = 0;
  let z = 0;

  while (left.size) {
    const first = [...left].find((i) => fitsFootprint(pieces[i], box.l, box.w) && z + pieces[i].h <= box.h && grams + pieces[i].grams <= maxGrams);
    if (first === undefined) break;
    const layerH = pieces[first].h;
    let placedInLayer = false;
    let y = 0;

    // Rows across the layer. A row is as deep as the first piece in it.
    while (true) {
      let rowDepth = 0;
      let x = 0;
      for (const i of [...left]) {
        const p = pieces[i];
        if (p.h > layerH || grams + p.grams > maxGrams) continue;
        // Long side along the row if it fits, otherwise turned 90°.
        const along = [p.l, p.w].find((a, k) => {
          const across = k === 0 ? p.w : p.l;
          return x + a <= box.l && y + across <= box.w && (rowDepth === 0 || across <= rowDepth);
        });
        if (along === undefined) continue;
        const across = along === p.l ? p.w : p.l;
        if (rowDepth === 0) rowDepth = across;
        x += along;
        grams += p.grams;
        left.delete(i);
        packed.push(i);
        placedInLayer = true;
      }
      if (rowDepth === 0) break;
      y += rowDepth;
    }
    if (!placedInLayer) break;
    z += layerH;
  }
  return packed;
}

function fitsFootprint(p: Piece, l: number, w: number) {
  return (p.l <= l && p.w <= w) || (p.w <= l && p.l <= w);
}

export function quoteShipping(pieces: ShipPiece[], cfg: ShippingConfig): ShippingQuote {
  if (!cfg.enabled) return { ok: false, reason: "Shipping isn't available right now." };
  if (!pieces.length) return { ok: false, reason: "Nothing to ship." };
  if (pieces.length > MAX_PIECES) return { ok: false, reason: "This order is too big to ship. Please choose pickup." };

  const boxes = quoteBoxes(pieces, cfg);
  if ("reason" in boxes) return { ok: false, reason: boxes.reason };
  const mailer = quoteMailer(pieces, cfg);
  return { ok: true, options: mailer && mailer.totalCents < boxes.totalCents ? [mailer, boxes] : [boxes], parcel: parcelMailer(pieces, cfg) };
}

/** The pieces packed flat in one mailer, up to the parcel thickness limit. */
function flatInMailer(pieces: ShipPiece[], cfg: ShippingConfig, maxThickness: number) {
  const m = cfg.mailer;
  const list: Piece[] = pieces.map((p) => ({ ...flat([p.sizeMm.x, p.sizeMm.y, p.sizeMm.z]), grams: p.grams }));
  const space = { ...flat(m.sizeMm), h: maxThickness };
  // One layer only: a mailer can't be stacked inside.
  if (list.some((p) => p.h > space.h) || packOne(list, space, Infinity).length !== list.length) return null;
  return { grams: list.reduce((g, p) => g + p.grams, 0) + m.packagingGrams, thickness: Math.max(...list.map((p) => p.h)) };
}

function parcelMailer(pieces: ShipPiece[], cfg: ShippingConfig): ParcelMailer | null {
  const p = cfg.mailer.parcel;
  if (!cfg.mailer.enabled || !p.enabled) return null;
  const fit = flatInMailer(pieces, cfg, p.maxThicknessMm);
  if (!fit || fit.grams > cfg.maxGramsPerBox) return null;
  // The bubbles add about 6 mm to the thickness.
  return { grams: fit.grams, sizeMm: [p.outerMm[0], p.outerMm[1], Math.ceil(fit.thickness + 6)], pieces: pieces.length };
}

/** The parcel-mailer option, once Canada Post has priced it. */
/** Tax on postage, rounded to the cent. */
export function postageTax(postageCents: number, cfg: ShippingConfig) {
  return Math.round(postageCents * cfg.tax.rate);
}

/** Canada Post prices parcels itself, tax included, so its own tax figure is used here. */
export function parcelOption(parcel: ParcelMailer, rate: { baseCents: number; taxCents: number }, cfg: ShippingConfig): ShippingOption {
  return {
    method: "parcel",
    tracked: true,
    boxes: [{ id: PARCEL_MAILER_ID, name: "Bubble mailer (parcel)", priceCents: rate.baseCents, pieces: parcel.pieces }],
    postageCents: rate.baseCents,
    taxCents: rate.taxCents,
    taxLabel: cfg.tax.label,
    packingCents: cfg.mailer.packingFeeCents,
    totalCents: rate.baseCents + rate.taxCents + cfg.mailer.packingFeeCents,
  };
}

/** Cheapest first. */
export function withParcel(options: ShippingOption[], parcel: ShippingOption | null) {
  return parcel ? [...options, parcel].sort((a, b) => a.totalCents - b.totalCents) : options;
}

/** One bubble mailer, if every piece lies flat in it together and it's within Lettermail's weight. */
function quoteMailer(pieces: ShipPiece[], cfg: ShippingConfig): ShippingOption | null {
  const m = cfg.mailer;
  if (!m.enabled) return null;
  const fit = flatInMailer(pieces, cfg, flat(m.sizeMm).h);
  const rate = fit && m.rates.find((r) => fit.grams <= r.upToGrams);
  if (!rate) return null;
  return {
    method: "mailer",
    tracked: false,
    boxes: [{ id: MAILER_ID, name: "Bubble mailer", priceCents: rate.priceCents, pieces: pieces.length }],
    postageCents: rate.priceCents,
    taxCents: postageTax(rate.priceCents, cfg),
    taxLabel: cfg.tax.label,
    packingCents: m.packingFeeCents,
    totalCents: rate.priceCents + postageTax(rate.priceCents, cfg) + m.packingFeeCents,
  };
}

function quoteBoxes(pieces: ShipPiece[], cfg: ShippingConfig): ShippingOption | { reason: string } {
  const pad = cfg.paddingMm * 2;
  const maxGrams = cfg.maxGramsPerBox - cfg.packagingGrams;
  const boxes: Box[] = cfg.boxes.map((b) => ({ ...b, ...flat(b.sizeMm) })).sort((a, b) => a.priceCents - b.priceCents);
  const largest = boxes.reduce((a, b) => (b.l * b.w * b.h > a.l * a.w * a.h ? b : a));
  const list: Piece[] = pieces.map((p) => ({ ...flat([p.sizeMm.x + pad, p.sizeMm.y + pad, p.sizeMm.z + pad]), grams: p.grams }));

  for (const p of list) {
    if (!boxes.some((b) => p.l <= b.l && p.w <= b.w && p.h <= b.h)) {
      const size = [largest.l, largest.w, largest.h].map((d) => Math.round((d - pad) / 10)).join(" × ");
      return { reason: `One of your prints is too big for a shipping box (the largest fits about ${size} cm). Please choose pickup.` };
    }
    if (p.grams > maxGrams) return { reason: "One of your prints is too heavy to ship. Please choose pickup." };
  }

  // Fill boxes until everything is packed. A piece that only fits a smaller
  // box's shape (never happens with Canada Post's sizes) gets its own box.
  let remaining = list;
  const bins: Piece[][] = [];
  while (remaining.length) {
    let took = packOne(remaining, largest, maxGrams);
    if (!took.length) took = [0];
    const set = new Set(took);
    bins.push(took.map((i) => remaining[i]));
    remaining = remaining.filter((_, i) => !set.has(i));
  }

  const rows = bins
    .map((bin) => {
      const box = boxes.find((b) => packOne(bin, b, maxGrams).length === bin.length) ?? largest;
      return { id: box.id, name: box.name, priceCents: box.priceCents, pieces: bin.length };
    })
    .sort((a, b) => b.priceCents - a.priceCents);
  const postageCents = rows.reduce((s, b) => s + b.priceCents, 0);
  const packingCents = rows.length * cfg.packingFeePerBoxCents;
  const taxCents = postageTax(postageCents, cfg);
  return { method: "box", tracked: true, boxes: rows, postageCents, taxCents, taxLabel: cfg.tax.label, packingCents, totalCents: postageCents + taxCents + packingCents };
}

/** "Bubble mailer" / "Medium flat rate box" */
export function packageName(b: { id: string; name: string }) {
  if (b.id === MAILER_ID) return "Bubble mailer";
  if (b.id === PARCEL_MAILER_ID) return "Bubble mailer (parcel)";
  return `${b.name} flat rate box`;
}

/** "Bubble mailer" / "1 Medium box" / "2 boxes (Large, Small)" */
export function describeBoxes(boxes: { id?: string; name: string }[]) {
  if (boxes[0]?.id === MAILER_ID || boxes[0]?.id === PARCEL_MAILER_ID) return packageName(boxes[0] as { id: string; name: string });
  if (boxes.length === 1) return `1 ${boxes[0].name} box`;
  return `${boxes.length} boxes (${boxes.map((b) => b.name).join(", ")})`;
}
