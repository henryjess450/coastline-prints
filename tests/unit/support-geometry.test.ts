import { describe, expect, it } from "vitest";
import { buildSupportTree, SUPPORT_STRIDE } from "@/lib/model/support-geometry";

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return f.flatMap((t) => t.flatMap((k) => v[k]));
}
const branches = (s: Float32Array) => Array.from({ length: s.length / SUPPORT_STRIDE }, (_, i) => Array.from(s.slice(i * SUPPORT_STRIDE, (i + 1) * SUPPORT_STRIDE)));

describe("ghost tree supports", () => {
  it("draws nothing for a model with no overhangs", () => {
    expect(buildSupportTree(Float32Array.from(box(0, 0, 0, 20, 20, 20))).length).toBe(0);
  });

  it("holds up a tabletop: trunks from the bed, tips at the underside, never above it", () => {
    const table = Float32Array.from([...box(0, 0, 0, 4, 4, 30), ...box(36, 0, 0, 40, 4, 30), ...box(0, 36, 0, 4, 40, 30), ...box(36, 36, 0, 40, 40, 30), ...box(0, 0, 30, 40, 40, 33)]);
    const b = branches(buildSupportTree(table));
    expect(b.length).toBeGreaterThan(10);
    for (const [x0, y0, z0, x1, y1, z1] of b) {
      expect(z0).toBeGreaterThanOrEqual(-0.01); // starts on or above the bed
      expect(z1).toBeLessThanOrEqual(30.01); // reaches no higher than the underside
      expect(z1).toBeGreaterThan(z0);
      for (const v of [x0, y0, x1, y1]) expect(v).toBeGreaterThanOrEqual(-0.01);
    }
    // Some branches run all the way up to the tabletop.
    expect(b.some(([, , , , , z1]) => z1 > 29.9)).toBe(true);
    // And some start on the bed.
    expect(b.some(([, , z0]) => z0 < 0.01)).toBe(true);
  });

  it("stands supports on the model below, not just the bed", () => {
    // A slab 5 mm above a base: the supports start on the base's top (z = 5).
    const stacked = Float32Array.from([...box(0, 0, 0, 20, 20, 5), ...box(0, 0, 10, 20, 20, 12)]);
    const b = branches(buildSupportTree(stacked));
    expect(b.length).toBeGreaterThan(0);
    for (const [, , z0] of b) expect(z0).toBeGreaterThanOrEqual(4.99);
  });
});
