/**
 * Builds simple tree supports for the 3D preview (pure; runs in a worker).
 *
 * Input: the model's triangles already placed as printed (mm, Z up, bed at
 * z = 0). Tips go under every overhang on a small grid; nearby tips branch
 * together at 45° into one trunk that runs down to the bed or to the model
 * below. It's a picture of where supports go, not a slicer: the price comes
 * from the support estimate in supports.ts.
 *
 * Output: cylinders as [x0, y0, z0, x1, y1, z1, r0, r1] (bottom, top).
 */

const GRID = 96;

/** Numbers per cylinder in the output. */
export const SUPPORT_STRIDE = 8;

export function buildSupportTree(p: Float32Array, opts: { thresholdDeg?: number; maxTips?: number } = {}): Float32Array {
  const minDown = Math.cos(((opts.thresholdDeg ?? 30) * Math.PI) / 180);
  const maxTips = opts.maxTips ?? 500;
  const triCount = p.length / 9;
  if (!triCount) return new Float32Array(0);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, bed = Infinity;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] < minX) minX = p[i];
    if (p[i] > maxX) maxX = p[i];
    if (p[i + 1] < minY) minY = p[i + 1];
    if (p[i + 1] > maxY) maxY = p[i + 1];
    if (p[i + 2] < bed) bed = p[i + 2];
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const cx = (x: number) => Math.min(GRID - 1, Math.max(0, Math.floor(((x - minX) / spanX) * GRID)));
  const cy = (y: number) => Math.min(GRID - 1, Math.max(0, Math.floor(((y - minY) / spanY) * GRID)));

  // Up-facing triangles (what supports can stand on), bucketed by XY cell; and the overhangs.
  const buckets: number[][] = Array.from({ length: GRID * GRID }, () => []);
  const overhangs: number[] = [];
  let overhangArea = 0;
  for (let t = 0; t < triCount; t++) {
    const i = t * 9;
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
    const vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (!len) continue;
    if (nz > 0) {
      const x0 = cx(Math.min(p[i], p[i + 3], p[i + 6])), x1 = cx(Math.max(p[i], p[i + 3], p[i + 6]));
      const y0 = cy(Math.min(p[i + 1], p[i + 4], p[i + 7])), y1 = cy(Math.max(p[i + 1], p[i + 4], p[i + 7]));
      for (let a = x0; a <= x1; a++) for (let b = y0; b <= y1; b++) buckets[a * GRID + b].push(t);
    } else if (nz / len <= -minDown) {
      overhangs.push(t);
      overhangArea += (len / 2) * (-nz / len);
    }
  }
  if (!overhangs.length) return new Float32Array(0);

  /** Highest up-facing surface under (x, y) below z, else the bed. */
  const floorAt = (x: number, y: number, z: number) => {
    let best = bed;
    for (const t of buckets[cx(x) * GRID + cy(y)]) {
      const i = t * 9;
      const d = (p[i + 4] - p[i + 7]) * (p[i] - p[i + 6]) + (p[i + 6] - p[i + 3]) * (p[i + 1] - p[i + 7]);
      if (Math.abs(d) < 1e-12) continue;
      const w0 = ((p[i + 4] - p[i + 7]) * (x - p[i + 6]) + (p[i + 6] - p[i + 3]) * (y - p[i + 7])) / d;
      const w1 = ((p[i + 7] - p[i + 1]) * (x - p[i + 6]) + (p[i] - p[i + 6]) * (y - p[i + 7])) / d;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const fz = w0 * p[i + 2] + w1 * p[i + 5] + w2 * p[i + 8];
      if (fz <= z - 0.2 && fz > best) best = fz;
    }
    return best;
  };

  // Tips on a grid under the overhangs (spacing grows on big models so the preview stays light).
  const d = Math.max(2.5, Math.sqrt(overhangArea / maxTips));
  const tips: { x: number; y: number; z: number; floor: number }[] = [];
  const seen = new Set<string>();
  const addTip = (x: number, y: number, z: number) => {
    const key = `${Math.round(x / d)},${Math.round(y / d)},${Math.round(z)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const floor = floorAt(x, y, z);
    if (z - floor >= 1) tips.push({ x, y, z, floor });
  };
  for (const t of overhangs) {
    const i = t * 9;
    const x0 = Math.min(p[i], p[i + 3], p[i + 6]), x1 = Math.max(p[i], p[i + 3], p[i + 6]);
    const y0 = Math.min(p[i + 1], p[i + 4], p[i + 7]), y1 = Math.max(p[i + 1], p[i + 4], p[i + 7]);
    const det = (p[i + 4] - p[i + 7]) * (p[i] - p[i + 6]) + (p[i + 6] - p[i + 3]) * (p[i + 1] - p[i + 7]);
    let hits = 0;
    if (Math.abs(det) > 1e-12) {
      for (let x = Math.ceil(x0 / d) * d; x <= x1; x += d) {
        for (let y = Math.ceil(y0 / d) * d; y <= y1; y += d) {
          const w0 = ((p[i + 4] - p[i + 7]) * (x - p[i + 6]) + (p[i + 6] - p[i + 3]) * (y - p[i + 7])) / det;
          const w1 = ((p[i + 7] - p[i + 1]) * (x - p[i + 6]) + (p[i] - p[i + 6]) * (y - p[i + 7])) / det;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          hits++;
          addTip(x, y, w0 * p[i + 2] + w1 * p[i + 5] + w2 * p[i + 8]);
        }
      }
    }
    // Small overhangs between grid points still get one tip at their centre.
    if (!hits && (x1 - x0) * (y1 - y0) > (d * d) / 8) addTip((p[i] + p[i + 3] + p[i + 6]) / 3, (p[i + 1] + p[i + 4] + p[i + 7]) / 3, (p[i + 2] + p[i + 5] + p[i + 8]) / 3);
    if (tips.length > maxTips * 3) break;
  }

  // Group nearby tips that land on the same surface; each group branches into one trunk.
  const D = d * 4;
  const groups = new Map<string, typeof tips>();
  for (const t of tips) {
    const key = `${Math.floor(t.x / D)},${Math.floor(t.y / D)},${Math.round(t.floor / 5)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }

  const out: number[] = [];
  const cyl = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r0: number, r1: number) => {
    if (z1 - z0 > 0.05 || Math.hypot(x1 - x0, y1 - y0) > 0.05) out.push(x0, y0, z0, x1, y1, z1, r0, r1);
  };
  for (const g of groups.values()) {
    const gx = g.reduce((s, t) => s + t.x, 0) / g.length;
    const gy = g.reduce((s, t) => s + t.y, 0) / g.length;
    const reach = Math.max(...g.map((t) => Math.hypot(t.x - gx, t.y - gy)));
    const lowestTip = Math.min(...g.map((t) => t.z));
    const nodeZ = lowestTip - reach; // 45° branches
    // The surface under the group, found from the tips' height (the join point could be inside the model).
    const nodeFloor = Math.max(floorAt(gx, gy, lowestTip), ...g.map((t) => t.floor));
    if (g.length === 1 || nodeZ - nodeFloor < 2) {
      for (const t of g) cyl(t.x, t.y, t.floor, t.x, t.y, t.z, 0.9, 0.45);
      continue;
    }
    cyl(gx, gy, nodeFloor, gx, gy, nodeZ, Math.min(2.2, 0.9 + 0.15 * g.length), 1 + 0.08 * g.length);
    for (const t of g) cyl(gx, gy, nodeZ, t.x, t.y, t.z, 0.8, 0.4);
  }
  return Float32Array.from(out);
}
