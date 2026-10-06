import { describe, expect, it } from "vitest";
import { rasterizeSilhouette } from "@/lib/order/silhouette";
import { boxTriangles, toBinaryStl } from "../helpers/meshes";
import { parseStl } from "@/lib/stl/parse";

describe("model silhouette", () => {
  it("fills a cube's front face solidly", () => {
    const positions = parseStl(toBinaryStl(boxTriangles(20, 20, 20)).buffer as ArrayBuffer).positions;
    const r = rasterizeSilhouette(positions, 40)!;
    const filled = r.grid.reduce((n, v) => n + v, 0);
    expect(filled / (r.width * r.height)).toBeGreaterThan(0.8);
  });

  it("handles a 2-million-triangle model quickly (no frozen page)", () => {
    // A dense wavy sheet standing up: lots of tiny triangles, like a big detailed STL.
    const n = 1000; // 1000 × 1000 grid × 2 triangles = 2,000,000 triangles
    const positions = new Float32Array(n * n * 2 * 9);
    let o = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x0 = i / n, x1 = (i + 1) / n, z0 = j / n, z1 = (j + 1) / n;
        for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]]) {
          positions[o++] = x * 100;
          positions[o++] = Math.sin(x * 20) * 2;
          positions[o++] = z * 100;
        }
      }
    const start = performance.now();
    const r = rasterizeSilhouette(positions)!;
    const ms = performance.now() - start;
    expect(r.grid.reduce((a, v) => a + v, 0)).toBeGreaterThan(r.width * r.height * 0.9);
    expect(ms).toBeLessThan(1500);
    console.info(`2M triangles rasterised in ${ms.toFixed(0)} ms`);
  });
});
