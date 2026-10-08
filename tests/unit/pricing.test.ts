import { describe, expect, it } from "vitest";
import { defaultConfig, type AppConfig } from "@/lib/config/types";
import { estimateGrams, estimateHours, quoteItem, quoteOrder, type ItemSpec } from "@/lib/pricing/quote";

const cfg = defaultConfig();

/** A 20 mm cube: 8000 mm³, 2400 mm². */
const cube = (over: Partial<ItemSpec> = {}): ItemSpec => ({
  size: { x: 20, y: 20, z: 20 },
  volumeMm3: 8000,
  surfaceAreaMm2: 2400,
  material: "PLA",
  colorId: "orange",
  quality: "standard",
  infill: "standard",
  quantity: 1,
  ...over,
});

describe("estimates", () => {
  it("solid infill weighs the full volume × density", () => {
    expect(estimateGrams(8000, 2400, 1.24, 1, 1.2)).toBeCloseTo(9.92, 9);
  });

  it("shell + infill model", () => {
    // shell = 2400 × 1.2 = 2880; inside = 5120 × 0.15 = 768 → 3648 mm³ × 1.24 g/cm³
    expect(estimateGrams(8000, 2400, 1.24, 0.15, 1.2)).toBeCloseTo(4.52352, 9);
  });

  it("caps the shell at the full volume for thin parts", () => {
    expect(estimateGrams(100, 10_000, 1.24, 0.1, 1.2)).toBeCloseTo(0.124, 9);
  });

  it("time scales with printer speed", () => {
    expect(estimateHours(22, 22, 1)).toBe(1);
    expect(estimateHours(22, 22, 1.2)).toBeCloseTo(1 / 1.2, 9);
  });
});

describe("item pricing", () => {
  it("itemizes filament, machine time and markup", () => {
    const q = quoteItem(cube(), cfg);
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    const grams = 4.52352;
    const hours = grams / 22 + 0.15;
    expect(q.gramsEach).toBeCloseTo(grams, 6);
    expect(q.filamentCents).toBe(Math.round(grams * 3));
    expect(q.machineCents).toBe(Math.round(hours * 100));
    expect(q.markupCents).toBe(50);
    expect(q.lineCents).toBe(q.filamentCents + q.machineCents + 50);
    expect(q.assignment.printer.id).toBe("a1-mini");
  });

  it("quantity multiplies grams, hours and markup but setup is charged once", () => {
    const one = quoteItem(cube(), cfg);
    const five = quoteItem(cube({ quantity: 5 }), cfg);
    if (!one.ok || !five.ok) throw new Error("expected ok");
    expect(five.markupCents).toBe(250);
    expect(five.hoursTotal).toBeCloseTo(one.hoursEach * 5 + 0.15, 9);
    expect(five.filamentCents).toBe(Math.round(one.gramsEach * 5 * 3));
  });

  it("uses a colour's own per-gram rate (PLA Wood)", () => {
    const wood = quoteItem(cube({ colorId: "wood", infill: "solid" }), cfg);
    if (!wood.ok) throw new Error("expected ok");
    expect(wood.filamentCents).toBe(Math.round(9.92 * 4));
  });

  it("rejects unavailable colours and unknown settings", () => {
    const c: AppConfig = defaultConfig();
    c.materials[0].colors.find((x) => x.id === "orange")!.available = false;
    expect(quoteItem(cube(), c).ok).toBe(false);
    expect(quoteItem(cube({ quality: "ultra" }), cfg).ok).toBe(false);
    expect(quoteItem(cube({ colorId: "nope" }), cfg).ok).toBe(false);
  });

  it("blocks parts that don't fit any printer", () => {
    const q = quoteItem(cube({ size: { x: 300, y: 20, z: 20 } }), cfg);
    expect(q.ok).toBe(false);
  });

  it("blocks zero-volume models", () => {
    expect(quoteItem(cube({ volumeMm3: 0 }), cfg).ok).toBe(false);
  });
});

describe("order pricing", () => {
  it("charges the base fee once per order", () => {
    const a = quoteItem(cube(), cfg);
    const order = quoteOrder([cube(), cube()], cfg);
    if (!a.ok) throw new Error("expected ok");
    expect(order.baseFeeCents).toBe(750);
    expect(order.subtotalCents).toBe(a.lineCents * 2);
    expect(order.totalCents).toBe(750 + a.lineCents * 2);
  });

  it("raises small orders to the minimum", () => {
    const c = defaultConfig();
    c.pricing.minimumOrderCents = 2000;
    const order = quoteOrder([cube()], c);
    expect(order.totalCents).toBe(2000);
    expect(order.minimumAdjCents).toBe(2000 - 750 - order.subtotalCents);
  });

  it("doesn't adjust orders already above the minimum", () => {
    const order = quoteOrder([cube({ quantity: 10 })], cfg);
    expect(order.minimumAdjCents).toBe(0);
  });

  it("is exactly at the minimum boundary without adjustment", () => {
    const c = defaultConfig();
    const sub = quoteOrder([cube()], c).subtotalCents;
    c.pricing.minimumOrderCents = 750 + sub;
    const order = quoteOrder([cube()], c);
    expect(order.minimumAdjCents).toBe(0);
    expect(order.totalCents).toBe(750 + sub);
  });

  it("is not ok if any item fails, and empty orders are not ok", () => {
    expect(quoteOrder([cube(), cube({ size: { x: 999, y: 1, z: 1 } })], cfg).ok).toBe(false);
    expect(quoteOrder([], cfg).ok).toBe(false);
  });
});

describe("print time limit", () => {
  const max = cfg.estimation.maxHoursPerPiece;
  /** A solid cube `mm` on a side. */
  const block = (mm: number, over: Partial<ItemSpec> = {}) => cube({ size: { x: mm, y: mm, z: mm }, volumeMm3: mm ** 3, surfaceAreaMm2: 6 * mm * mm, infill: "solid", ...over });

  it("refuses a piece that would print for longer than the limit, and suggests a size that fits", () => {
    const q = quoteItem(block(150), cfg);
    expect(q.ok).toBe(false);
    if (q.ok) return;
    expect(q.tooLong?.maxHours).toBe(max);
    expect(q.tooLong!.hours).toBeGreaterThan(max);
    const pct = q.tooLong!.fitPercent!;
    expect(q.error).toContain(`${pct}%`);
    // The suggested size really does fit, and a bit bigger doesn't.
    expect(quoteItem(block(150 * (pct / 100)), cfg).ok).toBe(true);
    expect(quoteItem(block(150 * ((pct + 2) / 100)), cfg).ok).toBe(false);
  });

  it("only counts one piece: lots of short copies are fine", () => {
    const q = quoteItem(cube({ quantity: 50 }), cfg);
    expect(q.ok).toBe(true);
    if (q.ok) expect(q.hoursTotal).toBeLessThan(max * 50);
  });

  it("blocks the whole order", () => {
    expect(quoteOrder([cube(), block(150)], cfg).ok).toBe(false);
  });
});
