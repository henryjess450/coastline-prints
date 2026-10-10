import { describe, expect, it } from "vitest";
import { defaultConfig } from "@/lib/config/types";
import { supportProfile, upDirection } from "@/lib/model/supports";
import { quoteItem, type ItemSpec } from "@/lib/pricing/quote";
import { computeMeshStats } from "@/lib/stl/analyze";

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return f.flatMap((t) => t.flatMap((k) => v[k]));
}
// A "T": a 4 × 4 × 10 post with a 20 × 4 × 2 bar on top. Each 8 mm arm overhangs 10 mm above the bed.
const T = Float32Array.from([...box(8, 0, 0, 12, 4, 10), ...box(0, 0, 10, 20, 4, 12)]);

describe("finding overhangs", () => {
  it("measures the space under overhangs down to the bed", () => {
    const p = supportProfile(T);
    expect(p.dirs[0].volumeMm3).toBeGreaterThan(600); // two arms: 2 × 8 × 4 × 10 = 640
    expect(p.dirs[0].volumeMm3).toBeLessThan(680);
    expect(p.dirs[0].areaMm2).toBeCloseTo(64, -1);
  });

  it("needs nothing when the model sits flat with nothing hanging out", () => {
    expect(supportProfile(Float32Array.from(box(0, 0, 0, 10, 10, 10))).dirs[0].volumeMm3).toBe(0);
    // Upside down, the T's bar is on the bed and the post stands on it.
    expect(upDirection(1)).toEqual({ axis: 2, sign: -1 });
    expect(supportProfile(T).dirs[1].volumeMm3).toBe(0);
  });

  it("stops at the model below, not just the bed", () => {
    // A 20 × 20 slab floating 5 mm above a 20 × 20 base 5 mm tall: supports only span the 5 mm gap.
    const stacked = Float32Array.from([...box(0, 0, 0, 20, 20, 5), ...box(0, 0, 10, 20, 20, 12)]);
    expect(supportProfile(stacked).dirs[0].volumeMm3).toBeCloseTo(20 * 20 * 5, -1);
  });
});

describe("support pricing", () => {
  const cfg = defaultConfig();
  const stats = computeMeshStats(T);
  const spec = (over: Partial<ItemSpec> = {}): ItemSpec => ({
    size: stats.bbox.size,
    volumeMm3: stats.volumeMm3,
    surfaceAreaMm2: stats.surfaceAreaMm2,
    material: "PLA",
    colorId: "red-matte",
    quality: "standard",
    infill: "standard",
    quantity: 1,
    supportProfile: supportProfile(T),
    scale: { x: 1, y: 1, z: 1 },
    ...over,
  });

  it("adds tree supports to the filament, time and price", () => {
    // Printed 4× bigger, so the supports are worth more than a cent.
    const big = { scale: { x: 4, y: 4, z: 4 }, size: { x: stats.bbox.size.x * 4, y: stats.bbox.size.y * 4, z: stats.bbox.size.z * 4 }, volumeMm3: stats.volumeMm3 * 64, surfaceAreaMm2: stats.surfaceAreaMm2 * 16 };
    const withS = quoteItem(spec(big), cfg);
    const without = quoteItem(spec({ ...big, supportProfile: null }), cfg);
    expect(withS.ok && without.ok).toBe(true);
    if (!withS.ok || !without.ok) return;
    expect(withS.supportGramsEach).toBeGreaterThan(0);
    expect(withS.gramsEach).toBeCloseTo(without.gramsEach + withS.supportGramsEach, 6);
    expect(withS.hoursEach).toBeGreaterThan(without.hoursEach);
    expect(withS.lineCents).toBeGreaterThan(without.lineCents);
  });

  it("scales supports with the printed size (twice as big: 8 times the plastic, roughly)", () => {
    const one = quoteItem(spec(), cfg);
    const big = { x: 2, y: 2, z: 2 };
    const two = quoteItem(spec({ scale: big, size: { x: stats.bbox.size.x * 2, y: stats.bbox.size.y * 2, z: stats.bbox.size.z * 2 }, volumeMm3: stats.volumeMm3 * 8, surfaceAreaMm2: stats.surfaceAreaMm2 * 4 }), cfg);
    if (one.ok && two.ok) {
      expect(two.supportGramsEach / one.supportGramsEach).toBeGreaterThan(6);
      expect(two.supportGramsEach / one.supportGramsEach).toBeLessThan(8.01);
    }
  });

  it("can be turned off in the config", () => {
    const q = quoteItem(spec(), { ...cfg, supports: { ...cfg.supports, enabled: false } });
    expect(q.ok && q.supportGramsEach).toBe(0);
  });
});
