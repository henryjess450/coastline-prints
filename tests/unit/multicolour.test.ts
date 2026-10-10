import { describe, expect, it } from "vitest";
import { materials } from "@config/materials";
import { defaultConfig } from "@/lib/config/types";
import { colorDistance, defaultColorMap, listNames, mappedColors, nearestColor } from "@/lib/model/colors";
import { quoteItem, type ItemSpec } from "@/lib/pricing/quote";

const pla = materials.find((m) => m.id === "PLA")!.colors;

describe("matching file colours to stock", () => {
  it("picks the colour that looks closest", () => {
    expect(nearestColor("#DE4343", pla)?.id).toBe("red-matte");
    expect(nearestColor("#3F8E43", pla)?.id).toBe("green");
    expect(nearestColor("#1A2F80", pla)?.id).toBe("dark-blue");
    // Never auto-picks the rainbow spool, however close its preview colour is.
    expect(nearestColor("#E2479A", pla)?.id).not.toBe("rainbow-matte");
    expect(colorDistance("#FFFFFF", "#FFFFFF")).toBe(0);
  });

  it("keeps earlier picks that are still in stock", () => {
    const hex = (n: number) => ["#DE4343", "#3F8E43"][n - 1];
    expect(defaultColorMap([1, 2], hex, pla)).toEqual({ 1: "red-matte", 2: "green" });
    expect(defaultColorMap([1, 2], hex, pla, { 1: "purple", 2: "gone" })).toEqual({ 1: "purple", 2: "green" });
  });

  it("names the colours most-covered first", () => {
    const m = mappedColors({ 1: "green", 2: "red-matte", 3: "green" }, { 1: 0.3, 2: 0.5, 3: 0.2 }, pla);
    expect(m.map((x) => x.id)).toEqual(["green", "red-matte"]);
    expect(listNames(["Red", "White", "Black"])).toBe("Red, White and Black");
  });
});

describe("multicolour pricing", () => {
  const cfg = defaultConfig();
  const spec = (over: Partial<ItemSpec> = {}): ItemSpec => ({
    size: { x: 40, y: 40, z: 40 },
    volumeMm3: 40000,
    surfaceAreaMm2: 9600,
    material: "PLA",
    colorId: "green",
    quality: "standard",
    infill: "standard",
    quantity: 1,
    ...over,
  });

  it("weights the per-gram price by how much of the surface each colour covers", () => {
    const plain = quoteItem(spec(), cfg);
    // Half the surface in wood (4¢/g), half in green (3¢/g): 3.5¢/g.
    const mixed = quoteItem(spec({ colorMap: { 1: "wood", 2: "green" }, colorShares: { 1: 0.5, 2: 0.5 } }), cfg);
    expect(plain.ok && mixed.ok).toBe(true);
    // Price per gram (the mixed print also pays for its flushed plastic, at the same blended rate).
    if (plain.ok && mixed.ok) {
      expect(plain.filamentCents / plain.gramsEach).toBeCloseTo(3, 1);
      expect(mixed.filamentCents / mixed.gramsEach).toBeCloseTo(3.5, 1);
    }
  });

  it("allows up to the printers' colour limit, and no unavailable colours", () => {
    const five = { 1: "red-matte", 2: "green", 3: "yellow", 4: "purple", 5: "orange" };
    expect(quoteItem(spec({ colorMap: five }), cfg)).toMatchObject({ ok: false, error: expect.stringMatching(/up to 4 colours/) });
    // Five file colours are fine when they share four stock colours (small part, so the changes fit in 12 hours).
    const small = { size: { x: 10, y: 10, z: 10 }, volumeMm3: 1000, surfaceAreaMm2: 600 };
    expect(quoteItem(spec({ ...small, colorMap: { ...five, 5: "red-matte" } }), cfg).ok).toBe(true);
    expect(quoteItem(spec({ colorMap: { 1: "green", 2: "nope" } }), cfg)).toMatchObject({ ok: false, error: expect.stringMatching(/isn't available/) });
  });
});
