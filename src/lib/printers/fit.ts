import type { PrinterConfig } from "@config/printers";
import type { MaterialId } from "@config/materials";
import type { Vec3 } from "@/lib/stl/analyze";

/**
 * The 6 axis-aligned orientations. Entry [a, b, c] means the model's original
 * axis a lies along the printer's X, b along Y, c along Z (0=x, 1=y, 2=z).
 */
export const ORIENTATIONS = [
  [0, 1, 2],
  [1, 0, 2],
  [0, 2, 1],
  [2, 1, 0],
  [1, 2, 0],
  [2, 0, 1],
] as const;

export type OrientationIndex = 0 | 1 | 2 | 3 | 4 | 5;

const EPS = 1e-6;

const axis = (v: Vec3, i: number) => (i === 0 ? v.x : i === 1 ? v.y : v.z);

export function orientDims(size: Vec3, o: OrientationIndex): Vec3 {
  const [a, b, c] = ORIENTATIONS[o];
  return { x: axis(size, a), y: axis(size, b), z: axis(size, c) };
}

export function usableVolume(printer: PrinterConfig, marginMm: number): Vec3 {
  return {
    x: printer.buildVolume.x - marginMm,
    y: printer.buildVolume.y - marginMm,
    z: printer.buildVolume.z - marginMm,
  };
}

export function fitsIn(dims: Vec3, usable: Vec3) {
  return dims.x <= usable.x + EPS && dims.y <= usable.y + EPS && dims.z <= usable.z + EPS;
}

/**
 * Finds an orientation that fits. Keeps the customer's orientation when it
 * fits; otherwise picks the fitting orientation with the lowest height
 * (more stable and usually faster to print).
 */
export function findFittingOrientation(size: Vec3, usable: Vec3, preferred: OrientationIndex = 0): OrientationIndex | null {
  if (fitsIn(orientDims(size, preferred), usable)) return preferred;
  let best: OrientationIndex | null = null;
  for (let i = 0 as OrientationIndex; i < 6; i = (i + 1) as OrientationIndex) {
    const d = orientDims(size, i);
    if (fitsIn(d, usable) && (best === null || d.z < orientDims(size, best).z)) best = i;
  }
  return best;
}

/** Largest uniform scale factor at which `size` fits `usable` in some orientation. */
export function maxUniformScale(size: Vec3, usable: Vec3): number {
  let best = 0;
  for (let i = 0 as OrientationIndex; i < 6; i = (i + 1) as OrientationIndex) {
    const d = orientDims(size, i);
    const s = Math.min(
      d.x > 0 ? usable.x / d.x : Infinity,
      d.y > 0 ? usable.y / d.y : Infinity,
      d.z > 0 ? usable.z / d.z : Infinity,
    );
    if (s > best) best = s;
  }
  return best;
}

export type PrinterAssignment =
  | { ok: true; printer: PrinterConfig; orientation: OrientationIndex; orientedSize: Vec3; autoOriented: boolean }
  | { ok: false; reason: "material" | "too-large"; message: string; largest?: PrinterConfig; maxScale?: number };

/**
 * Routes a model to a printer. Only printers that list the material are
 * considered (so PLA-CF only reaches hardened-nozzle machines); among those,
 * the lowest-priority-number printer it fits on wins.
 */
export function assignPrinter(
  size: Vec3,
  material: MaterialId,
  fleet: PrinterConfig[],
  marginMm: number,
  preferred: OrientationIndex = 0,
): PrinterAssignment {
  const capable = fleet.filter((p) => p.materials.includes(material)).sort((a, b) => a.priority - b.priority);
  if (capable.length === 0) {
    return { ok: false, reason: "material", message: `None of our printers can currently print ${material}.` };
  }

  for (const printer of capable) {
    const usable = usableVolume(printer, marginMm);
    const orientation = findFittingOrientation(size, usable, preferred);
    if (orientation !== null) {
      return { ok: true, printer, orientation, orientedSize: orientDims(size, orientation), autoOriented: orientation !== preferred };
    }
  }

  const largest = capable.reduce((a, b) => (volumeOf(b.buildVolume) > volumeOf(a.buildVolume) ? b : a));
  const usable = usableVolume(largest, marginMm);
  return {
    ok: false,
    reason: "too-large",
    largest,
    maxScale: maxUniformScale(size, usable),
    message: `At this size the model doesn't fit any printer that runs ${material}. The largest is the ${largest.name} (${usable.x} × ${usable.y} × ${usable.z} mm usable).`,
  };
}

const volumeOf = (v: Vec3) => v.x * v.y * v.z;

/**
 * Proper rotation (det = +1) that maps the model into an orientation.
 * Row-major 3×3. Odd permutations get one axis negated so the model is
 * rotated, never mirrored.
 */
export function orientationMatrix(o: OrientationIndex): number[] {
  const [a, b, c] = ORIENTATIONS[o];
  const odd = o === 1 || o === 2 || o === 3;
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  m[0 * 3 + a] = 1;
  m[1 * 3 + b] = 1;
  m[2 * 3 + c] = odd ? -1 : 1;
  return m;
}
