/**
 * Support estimate (pure, shared by the browser worker and the server).
 *
 * A downward-facing surface flatter than the threshold angle needs support,
 * like the slicer's auto supports. For each one we measure how far it is down
 * to the bed or to the model below, for each of the 6 ways up the model can
 * print. The result is scale-free, so it's computed once per upload:
 *   volume = Σ projected area × drop  (the space under the overhangs)
 *   area   = Σ projected area         (where supports touch the model)
 */
import { ORIENTATIONS } from "@/lib/printers/fit";

/** One entry per orientation (same order as ORIENTATIONS), in the file's own units. */
export type SupportProfile = { thresholdDeg: number; dirs: { volumeMm3: number; areaMm2: number }[] };

/** Which original axis points up, and whether it's flipped, for each orientation. */
export function upDirection(orientation: number): { axis: number; sign: 1 | -1 } {
  const o = ORIENTATIONS[orientation] ?? ORIENTATIONS[0];
  const odd = orientation === 1 || orientation === 2 || orientation === 3;
  return { axis: o[2], sign: odd ? -1 : 1 };
}

const GRID = 96;

export function supportProfile(positions: Float32Array, thresholdDeg = 30): SupportProfile {
  const triCount = positions.length / 9;
  // A face needs support when it faces down and is within the threshold of horizontal.
  const minDown = Math.cos((thresholdDeg * Math.PI) / 180);
  const dirs: SupportProfile["dirs"] = [];
  const done = new Map<string, SupportProfile["dirs"][number]>();

  for (let o = 0; o < 6; o++) {
    const { axis, sign } = upDirection(o);
    const key = `${axis}${sign}`;
    const hit = done.get(key);
    if (hit) {
      dirs.push(hit);
      continue;
    }
    // Horizontal axes for this way up.
    const h1 = (axis + 1) % 3;
    const h2 = (axis + 2) % 3;
    const up = (i: number) => positions[i + axis] * sign;

    // Bounds, and the triangles bucketed by the horizontal cells they cover.
    let min1 = Infinity, max1 = -Infinity, min2 = Infinity, max2 = -Infinity, minUp = Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      const a = positions[i + h1], b = positions[i + h2], u = positions[i + axis] * sign;
      if (a < min1) min1 = a;
      if (a > max1) max1 = a;
      if (b < min2) min2 = b;
      if (b > max2) max2 = b;
      if (u < minUp) minUp = u;
    }
    const span1 = max1 - min1 || 1;
    const span2 = max2 - min2 || 1;
    const sampleArea = (span1 / GRID) * (span2 / GRID) * 4;
    const cell = (v: number, min: number, span: number) => Math.min(GRID - 1, Math.max(0, Math.floor(((v - min) / span) * GRID)));
    const buckets: number[][] = Array.from({ length: GRID * GRID }, () => []);
    for (let t = 0; t < triCount; t++) {
      const i = t * 9;
      const a0 = cell(Math.min(positions[i + h1], positions[i + 3 + h1], positions[i + 6 + h1]), min1, span1);
      const a1 = cell(Math.max(positions[i + h1], positions[i + 3 + h1], positions[i + 6 + h1]), min1, span1);
      const b0 = cell(Math.min(positions[i + h2], positions[i + 3 + h2], positions[i + 6 + h2]), min2, span2);
      const b1 = cell(Math.max(positions[i + h2], positions[i + 3 + h2], positions[i + 6 + h2]), min2, span2);
      for (let x = a0; x <= a1; x++) for (let y = b0; y <= b1; y++) buckets[x * GRID + y].push(t);
    }

    // Supports stand on surfaces that face up (or the bed).
    const facesUp = new Uint8Array(triCount);
    for (let t = 0; t < triCount; t++) {
      const i = t * 9;
      const a = positions[i + 3 + h1] - positions[i + h1], b = positions[i + 3 + h2] - positions[i + h2];
      const c = positions[i + 6 + h1] - positions[i + h1], d = positions[i + 6 + h2] - positions[i + h2];
      // z-component (in this frame) of the normal, without normalising: just the sign matters.
      facesUp[t] = (a * d - b * c) * sign > 0 ? 1 : 0;
    }

    /** Height of the highest up-facing surface below (p1, p2), else the bed. */
    const floorBelow = (p1: number, p2: number, top: number) => {
      let best = minUp;
      for (const t of buckets[cell(p1, min1, span1) * GRID + cell(p2, min2, span2)]) {
        if (!facesUp[t]) continue;
        const i = t * 9;
        const x0 = positions[i + h1], y0 = positions[i + h2];
        const x1 = positions[i + 3 + h1], y1 = positions[i + 3 + h2];
        const x2 = positions[i + 6 + h1], y2 = positions[i + 6 + h2];
        const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
        if (Math.abs(d) < 1e-12) continue;
        const w0 = ((y1 - y2) * (p1 - x2) + (x2 - x1) * (p2 - y2)) / d;
        const w1 = ((y2 - y0) * (p1 - x2) + (x0 - x2) * (p2 - y2)) / d;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * up(i) + w1 * up(i + 3) + w2 * up(i + 6);
        if (z <= top + 1e-3 && z > best) best = z;
      }
      return best;
    };

    let volume = 0;
    let area = 0;
    for (let t = 0; t < triCount; t++) {
      const i = t * 9;
      const ux = positions[i + 3] - positions[i], uy = positions[i + 4] - positions[i + 1], uz = positions[i + 5] - positions[i + 2];
      const vx = positions[i + 6] - positions[i], vy = positions[i + 7] - positions[i + 1], vz = positions[i + 8] - positions[i + 2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const len = Math.hypot(n[0], n[1], n[2]);
      if (len === 0) continue;
      const nUp = (n[axis] * sign) / len;
      if (nUp > -minDown) continue; // not facing down steeply enough to need support
      const projected = (len / 2) * -nUp;
      // Big surfaces are measured at several points (k² equal pieces), so part
      // over the bed and part over the model each count correctly.
      const k = Math.min(16, Math.max(1, Math.ceil(Math.sqrt(projected / sampleArea))));
      const piece = projected / (k * k);
      for (let a = 0; a < k; a++) {
        for (let b = 0; a + b < k; b++) {
          for (const off of a + b < k - 1 ? [1 / 3, 2 / 3] : [1 / 3]) {
            const w1 = (a + off) / k;
            const w2 = (b + off) / k;
            const w0 = 1 - w1 - w2;
            const p1 = w0 * positions[i + h1] + w1 * positions[i + 3 + h1] + w2 * positions[i + 6 + h1];
            const p2 = w0 * positions[i + h2] + w1 * positions[i + 3 + h2] + w2 * positions[i + 6 + h2];
            const pu = w0 * up(i) + w1 * up(i + 3) + w2 * up(i + 6);
            const drop = pu - floorBelow(p1, p2, pu);
            if (drop < 0.3) continue; // resting on the bed or the model: nothing to hold up
            volume += piece * drop;
            area += piece;
          }
        }
      }
    }
    const r = { volumeMm3: volume, areaMm2: area };
    done.set(key, r);
    dirs.push(r);
  }
  return { thresholdDeg, dirs };
}
