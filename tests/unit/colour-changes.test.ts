import { describe, expect, it } from "vitest";
import { multicolor } from "@config/pricing";
import { defaultConfig } from "@/lib/config/types";
import { estimateChanges, flushVolume } from "@/lib/model/swaps";
import { colorProfile, type ColorProfile } from "@/lib/model/threemf";
import { quoteItem, type ItemSpec } from "@/lib/pricing/quote";

/** A 10 mm cube split at mid-height: bottom half filament 1, top half filament 2 (as triangles spanning each half). */
function stripedProfile(): ColorProfile {
  const tri = (z0: number, z1: number) => [0, 0, z0, 10, 0, z0, 0, 10, z1];
  const positions = Float32Array.from([...tri(0, 5), ...tri(5, 10)]);
  return colorProfile(positions, Uint8Array.from([1, 2]), 100);
}

const hex = { red: "#C8322B", white: "#FFFFFF", black: "#000000" } as Record<string, string>;
const run = (profile: ColorProfile, map: Record<number, string>, over: Partial<Parameters<typeof estimateChanges>[0]> = {}) =>
  estimateChanges({ profile, upAxis: 2, heightMm: 10, layerHeightMm: 0.2, colorOf: (n) => map[n], hexOf: (c) => hex[c], cfg: multicolor, ...over });

describe("counting colour changes", () => {
  it("changes once for a model in two bands", () => {
    const e = run(stripedProfile(), { 1: "red", 2: "white" });
    expect(e.changes).toBe(1);
    expect(e.flushMm3).toBeCloseTo(flushVolume(hex.red, hex.white, multicolor));
  });

  it("no change when both file colours print in the same filament", () => {
    expect(run(stripedProfile(), { 1: "red", 2: "red" })).toMatchObject({ changes: 0, flushMm3: 0, towerMm3: 0 });
  });

  it("changes on every layer when colours share layers, and builds a prime tower", () => {
    const all: ColorProfile = { bins: 1, axes: [[6], [6], [6]] }; // filaments 1 and 2 on every layer
    const e = run(all, { 1: "red", 2: "white" });
    expect(e.changes).toBe(50); // 50 layers, each starts with the colour already loaded: one change per layer
    expect(e.towerMm3).toBeCloseTo(50 * 0.2 * 35 * 35 * multicolor.primeTower.fill);
    expect(e.hours).toBeCloseTo((e.changes * multicolor.secondsPerChange) / 3600);
  });

  it("slices along whichever axis ends up vertical", () => {
    // Along x the cube's two triangles overlap completely: every slice has both colours.
    const p = stripedProfile();
    expect(run(p, { 1: "red", 2: "white" }, { upAxis: 0 }).changes).toBeGreaterThan(run(p, { 1: "red", 2: "white" }).changes);
  });

  it("flushes much more going dark to light", () => {
    expect(flushVolume(hex.black, hex.white, multicolor)).toBeGreaterThan(2.5 * flushVolume(hex.white, hex.black, multicolor));
    expect(flushVolume(hex.red, hex.red, multicolor)).toBe(0);
  });
});

describe("multicolour quotes", () => {
  const cfg = defaultConfig();
  const spec: ItemSpec = {
    size: { x: 10, y: 10, z: 10 },
    volumeMm3: 1000,
    surfaceAreaMm2: 600,
    material: "PLA",
    colorId: "red-matte",
    quality: "standard",
    infill: "standard",
    quantity: 1,
  };

  it("adds the flushed plastic, tower and change time to the price", () => {
    const one = quoteItem(spec, cfg);
    const two = quoteItem({ ...spec, colorMap: { 1: "red-matte", 2: "yellow" }, colorShares: { 1: 0.5, 2: 0.5 }, colorProfile: stripedProfile() }, cfg);
    expect(one.ok && two.ok).toBe(true);
    if (!one.ok || !two.ok) return;
    expect(two.multicolor).toMatchObject({ colors: 2, changes: 1 });
    expect(two.gramsEach).toBeGreaterThan(one.gramsEach + two.multicolor!.wasteGramsEach - 0.001);
    expect(two.hoursEach).toBeGreaterThan(one.hoursEach);
    expect(two.lineCents).toBeGreaterThan(one.lineCents + 250);
    // The AMS fee is once per item, not per copy.
    expect(two.multicolor!.amsFeeCents).toBe(250);
    const twoCopies = quoteItem({ ...spec, quantity: 2, colorMap: { 1: "red-matte", 2: "yellow" }, colorShares: { 1: 0.5, 2: 0.5 }, colorProfile: stripedProfile() }, cfg);
    if (twoCopies.ok) expect(twoCopies.lineCents - twoCopies.filamentCents - twoCopies.machineCents - twoCopies.markupCents).toBe(250);
  });

  it("only sends multicolour jobs to printers with enough colour slots", () => {
    const small = { ...cfg, printers: cfg.printers.map((p) => (p.id === "a1-mini" ? { ...p, maxColors: 1 } : p)) };
    const q = quoteItem({ ...spec, colorMap: { 1: "red-matte", 2: "yellow" }, colorProfile: stripedProfile() }, small);
    expect(q.ok && q.assignment.printer.id).toBe("centauri-carbon");
    expect(quoteItem(spec, small).ok && (quoteItem(spec, small) as { assignment: { printer: { id: string } } }).assignment.printer.id).toBe("a1-mini");
  });
});
