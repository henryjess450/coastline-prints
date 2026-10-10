/**
 * 3MF reader (Bambu Studio, Orca, PrusaSlicer and plain 3MF). Pure, so it runs
 * in the browser worker and on the server alike.
 *
 * Returns the build as one triangle soup in millimetres (every part placed
 * with its transforms, like an STL), plus a filament number for every
 * triangle: painted colours (Bambu "paint_color", Prusa "mmu_segmentation")
 * decoded exactly as the slicers do, otherwise the part's or object's filament.
 */
import { unzipSync, strFromU8 } from "fflate";

export class ThreeMfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThreeMfError";
  }
}

export type Filament = { hex: string; type: string | null };

/**
 * The model cut into `bins` equal slices along each original axis (x, y, z).
 * Each slice holds a bitmask of the filament numbers that appear in it
 * (bit n = filament n). Whichever axis ends up vertical gives the layers.
 */
export type ColorProfile = { bins: number; axes: [number[], number[], number[]] };

export const PROFILE_BINS = 512;

/** Which filaments touch each slice along each axis. */
export function colorProfile(positions: Float32Array, triColors: Uint8Array, bins = PROFILE_BINS): ColorProfile {
  const axes: [number[], number[], number[]] = [new Array(bins).fill(0), new Array(bins).fill(0), new Array(bins).fill(0)];
  for (let a = 0; a < 3; a++) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = a; i < positions.length; i += 3) {
      if (positions[i] < min) min = positions[i];
      if (positions[i] > max) max = positions[i];
    }
    const span = max - min || 1;
    const out = axes[a];
    for (let t = 0; t < triColors.length; t++) {
      const i = t * 9 + a;
      const lo = Math.min(positions[i], positions[i + 3], positions[i + 6]);
      const hi = Math.max(positions[i], positions[i + 3], positions[i + 6]);
      const b0 = Math.min(bins - 1, Math.floor(((lo - min) / span) * bins));
      const b1 = Math.min(bins - 1, Math.floor(((hi - min) / span) * bins));
      const bit = 2 ** Math.min(30, triColors[t]);
      for (let b = b0; b <= b1; b++) out[b] |= bit;
    }
  }
  return { bins, axes };
}

export type Parsed3mf = {
  positions: Float32Array;
  /**
   * The same build without paint splits. Use this for mesh checks (holes,
   * edges): split pieces leave T-junctions that look like holes but aren't.
   */
  basePositions: Float32Array;
  triangleCount: number;
  /** Filament number (1-based) for every triangle in `positions`. */
  triColors: Uint8Array;
  /** The project's filament slots (index 0 = filament 1). Empty when the file doesn't say. */
  filaments: Filament[];
  /** Filament numbers the model actually uses, ascending. */
  used: number[];
  /** Share of the surface each used filament covers (sums to 1), keyed by filament number. */
  shares: Record<number, number>;
  /** Which filaments appear at each height, along each axis (for counting colour changes). */
  profile: ColorProfile;
  /** Plain-language notes, e.g. "Only plate 1 of 3 is used." */
  notes: string[];
};

const MAX_TRIANGLES = 10_000_000;
/** Zip-bomb guard: total unzipped size of the files we read. */
const MAX_UNZIPPED = 600 * 1024 * 1024;
const UNITS: Record<string, number> = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

/** True for a zip (every 3MF is one). */
export function isZip(bytes: Uint8Array) {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

type Mat = number[]; // 12 numbers, 3MF order: m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32
const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

function parseMat(s: string | null): Mat {
  if (!s) return IDENTITY;
  const m = s.trim().split(/\s+/).map(Number);
  return m.length === 12 && m.every(Number.isFinite) ? m : IDENTITY;
}

/** a then b (3MF uses row vectors: p' = p · M). */
function mul(a: Mat, b: Mat): Mat {
  const r = new Array<number>(12);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      let v = row === 3 ? b[9 + col] : 0;
      for (let k = 0; k < 3; k++) v += a[row * 3 + k] * b[k * 3 + col];
      r[row * 3 + col] = v;
    }
  }
  return r;
}

const attrRes = new Map<string, RegExp>();
function attr(tag: string, name: string): string | null {
  let re = attrRes.get(name);
  if (!re) attrRes.set(name, (re = new RegExp(`(?:^|\\s)(?:[\\w-]+:)?${name}="([^"]*)"`)));
  return tag.match(re)?.[1] ?? null;
}

type MeshObject = { kind: "mesh"; vertices: Float32Array; triangles: Uint32Array; paint: (string | null)[] };
type CompObject = { kind: "components"; parts: { ref: string; transform: Mat }[] };
type Obj = MeshObject | CompObject;

/** Reads every <object> in one model file into `objects`, keyed "path#id". */
function readModelFile(path: string, xml: string, objects: Map<string, Obj>) {
  const unit = UNITS[xml.match(/<model[^>]*\sunit="([^"]+)"/)?.[1] ?? "millimeter"] ?? 1;
  let at = 0;
  for (;;) {
    const start = xml.indexOf("<object", at);
    if (start < 0) break;
    const open = xml.slice(start, xml.indexOf(">", start) + 1);
    const end = open.endsWith("/>") ? start + open.length : xml.indexOf("</object>", start);
    if (end < 0) throw new ThreeMfError("This 3MF file is damaged (an object never ends).");
    const body = xml.slice(start + open.length, end);
    at = end + 1;
    const id = attr(open, "id");
    if (!id) continue;

    const meshAt = body.indexOf("<mesh");
    if (meshAt >= 0) {
      const verts: number[] = [];
      const vre = /<vertex\s([^>]*?)\/?>/g;
      let m: RegExpExecArray | null;
      while ((m = vre.exec(body))) verts.push(Number(attr(m[1], "x")) * unit, Number(attr(m[1], "y")) * unit, Number(attr(m[1], "z")) * unit);
      const tris: number[] = [];
      const paint: (string | null)[] = [];
      const tre = /<triangle\s([^>]*?)\/?>/g;
      while ((m = tre.exec(body))) {
        tris.push(Number(attr(m[1], "v1")), Number(attr(m[1], "v2")), Number(attr(m[1], "v3")));
        paint.push(attr(m[1], "paint_color") ?? attr(m[1], "mmu_segmentation"));
        if (tris.length > MAX_TRIANGLES * 3) throw new ThreeMfError("The model has too many triangles to process.");
      }
      const vertices = Float32Array.from(verts);
      if (!vertices.every(Number.isFinite)) throw new ThreeMfError("This 3MF file contains invalid coordinates.");
      const triangles = Uint32Array.from(tris);
      const n = vertices.length / 3;
      for (const i of triangles) if (i >= n) throw new ThreeMfError("This 3MF file is damaged (a triangle points to a missing corner).");
      objects.set(`${path}#${id}`, { kind: "mesh", vertices, triangles, paint });
    } else {
      const parts: CompObject["parts"] = [];
      const cre = /<component\s([^>]*?)\/?>/g;
      let m: RegExpExecArray | null;
      while ((m = cre.exec(body))) {
        const ref = attr(m[1], "objectid");
        if (!ref) continue;
        const target = attr(m[1], "path") ?? path;
        parts.push({ ref: `${target.replace(/^\//, "")}#${ref}`, transform: parseMat(attr(m[1], "transform")) });
      }
      objects.set(`${path}#${id}`, { kind: "components", parts });
    }
  }
}

/** Filament slots from Bambu/Orca (JSON) or PrusaSlicer (ini) project settings. */
function readFilaments(files: Record<string, Uint8Array>): Filament[] {
  const bambu = files["Metadata/project_settings.config"];
  if (bambu) {
    try {
      const cfg = JSON.parse(strFromU8(bambu)) as { filament_colour?: string[]; filament_type?: string[] };
      return (cfg.filament_colour ?? []).map((hex, i) => ({ hex: normHex(hex), type: cfg.filament_type?.[i] ?? null }));
    } catch {
      // fall through
    }
  }
  const prusa = files["Metadata/Slic3r_PE.config"];
  if (prusa) {
    const ini = strFromU8(prusa);
    const list = (key: string) => ini.match(new RegExp(`^;\\s*${key}\\s*=\\s*(.*)$`, "m"))?.[1]?.split(";").map((s) => s.trim()) ?? [];
    const colours = list("extruder_colour").some((c) => c) ? list("extruder_colour") : list("filament_colour");
    const types = list("filament_type");
    return colours.map((hex, i) => ({ hex: normHex(hex), type: types[i] ?? null }));
  }
  return [];
}

function normHex(h: string) {
  const m = h.trim().match(/^#?([0-9a-f]{6})/i);
  return m ? `#${m[1].toUpperCase()}` : "#888888";
}

/** Which filament each object/part uses when not painted, and which objects are on plate 1. */
function readSettings(files: Record<string, Uint8Array>) {
  const raw = files["Metadata/model_settings.config"] ?? files["Metadata/Slic3r_PE_model.config"];
  const objectExtruder = new Map<string, number>();
  const partExtruder = new Map<string, number>();
  let plates: string[][] = [];
  if (!raw) return { objectExtruder, partExtruder, plates };
  const xml = strFromU8(raw);
  for (const o of xml.matchAll(/<object id="(\d+)"[^>]*>([\s\S]*?)<\/object>/g)) {
    const [, id, body] = o;
    const own = body.replace(/<(part|volume)\b[\s\S]*?<\/\1>/g, "");
    const ext = own.match(/key="extruder" value="(\d+)"/)?.[1];
    if (ext && Number(ext) > 0) objectExtruder.set(id, Number(ext));
    for (const p of body.matchAll(/<(?:part|volume)\b([^>]*)>([\s\S]*?)<\/(?:part|volume)>/g)) {
      const pid = attr(p[1], "id");
      const pext = p[2].match(/key="extruder" value="(\d+)"/)?.[1];
      if (pid && pext && Number(pext) > 0) partExtruder.set(`${id}/${pid}`, Number(pext));
    }
  }
  plates = [...xml.matchAll(/<plate>([\s\S]*?)<\/plate>/g)].map((p) => [...p[1].matchAll(/key="object_id" value="(\d+)"/g)].map((m) => m[1]));
  return { objectExtruder, partExtruder, plates };
}

/**
 * Paint tree decoder, matching TriangleSelector::deserialize in Bambu Studio
 * and PrusaSlicer. The hex string is read last character first, 4 bits each.
 * A leaf gives a state (0 = not painted, n = filament n); a split node gives
 * how many sides are split (1 to 3) and the special side, then its children
 * in reverse order. Calls `leaf` with each painted piece's corners.
 */
type V3 = [number, number, number];
const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

export function decodePaint(code: string, a: V3, b: V3, c: V3, leaf: (a: V3, b: V3, c: V3, state: number) => void) {
  const nib: number[] = [];
  for (let i = code.length - 1; i >= 0; i--) {
    const d = parseInt(code[i], 16);
    if (Number.isNaN(d)) return leaf(a, b, c, 0);
    nib.push(d);
  }
  let pos = 0;
  const next = () => (pos < nib.length ? nib[pos++] : -1);

  const node = (v: [V3, V3, V3], depth: number) => {
    const n = next();
    if (n < 0 || depth > 24) return leaf(v[0], v[1], v[2], 0);
    const split = n & 0b11;
    if (!split) {
      let state = n >> 2;
      if ((n & 0b1100) === 0b1100) {
        let x = next();
        let runs = 0;
        while (x === 0b1111) {
          runs++;
          x = next();
        }
        state = x < 0 ? 0 : x + 15 * runs + 3;
      }
      return leaf(v[0], v[1], v[2], state);
    }
    const s = n >> 2;
    const [p0, p1, p2] = [v[s % 3], v[(s + 1) % 3], v[(s + 2) % 3]];
    let kids: [V3, V3, V3][];
    if (split === 1) {
      const m = mid(p2, p1);
      kids = [
        [p0, p1, m],
        [m, p2, p0],
      ];
    } else if (split === 2) {
      const m01 = mid(p1, p0);
      const m02 = mid(p0, p2);
      kids = [
        [p0, m01, m02],
        [m01, p1, m02],
        [p1, p2, m02],
      ];
    } else {
      const m01 = mid(p1, p0);
      const m12 = mid(p2, p1);
      const m20 = mid(p0, p2);
      kids = [
        [p0, m01, m20],
        [m01, p1, m12],
        [m12, p2, m20],
        [m01, m12, m20],
      ];
    }
    // Children are stored last first.
    for (let k = kids.length - 1; k >= 0; k--) node(kids[k], depth + 1);
  };
  node([a, b, c], 0);
}

export function parse3mf(bytes: Uint8Array): Parsed3mf {
  if (!isZip(bytes)) throw new ThreeMfError("This doesn't look like a 3MF file.");
  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        const want = /\.model$/i.test(f.name) || /^Metadata\/(project_settings\.config|model_settings\.config|Slic3r_PE\.config|Slic3r_PE_model\.config)$/.test(f.name);
        if (want) total += f.originalSize;
        if (total > MAX_UNZIPPED) throw new ThreeMfError("This 3MF file is too large to process.");
        return want;
      },
    });
  } catch (err) {
    if (err instanceof ThreeMfError) throw err;
    throw new ThreeMfError("This 3MF file is damaged and couldn't be opened.");
  }

  const rootPath = Object.keys(files).find((n) => /^3D\/[^/]+\.model$/i.test(n));
  if (!rootPath) throw new ThreeMfError("This 3MF file has no 3D model in it.");
  const objects = new Map<string, Obj>();
  for (const [name, data] of Object.entries(files)) if (/\.model$/i.test(name)) readModelFile(name, strFromU8(data), objects);

  const rootXml = strFromU8(files[rootPath]);
  const build = rootXml.slice(rootXml.indexOf("<build"), rootXml.indexOf("</build>"));
  const items = [...build.matchAll(/<item\s([^>]*?)\/?>/g)]
    .map((m) => m[1])
    .filter((t) => attr(t, "printable") !== "0")
    .map((t) => ({ id: attr(t, "objectid") ?? "", transform: parseMat(attr(t, "transform")) }));
  if (!items.length) throw new ThreeMfError("This 3MF file has nothing to print in it.");

  const settings = readSettings(files);
  const notes: string[] = [];
  let chosen = items;
  if (settings.plates.length > 1) {
    const first = new Set(settings.plates[0]);
    const onFirst = items.filter((i) => first.has(i.id));
    if (onFirst.length) {
      chosen = onFirst;
      notes.push(`This project has ${settings.plates.length} plates. Only plate 1 is used; upload the others as separate files.`);
    }
  }

  const pos: number[] = [];
  const base: number[] = [];
  const cols: number[] = [];
  const emit = (a: V3, b: V3, c: V3, filament: number) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    cols.push(filament);
    if (cols.length > MAX_TRIANGLES) throw new ThreeMfError("The model has too many triangles to process.");
  };

  const place = (key: string, m: Mat, topId: string, defaultFil: number, depth: number) => {
    const obj = objects.get(key);
    if (!obj || depth > 16) return;
    if (obj.kind === "components") {
      for (const part of obj.parts) {
        const partId = part.ref.split("#")[1];
        const fil = settings.partExtruder.get(`${topId}/${partId}`) ?? defaultFil;
        place(part.ref, mul(part.transform, m), topId, fil, depth + 1);
      }
      return;
    }
    const { vertices: v, triangles: t, paint } = obj;
    const at = (i: number): V3 => {
      const x = v[i * 3];
      const y = v[i * 3 + 1];
      const z = v[i * 3 + 2];
      return [x * m[0] + y * m[3] + z * m[6] + m[9], x * m[1] + y * m[4] + z * m[7] + m[10], x * m[2] + y * m[5] + z * m[8] + m[11]];
    };
    for (let k = 0; k < t.length / 3; k++) {
      const a = at(t[k * 3]);
      const b = at(t[k * 3 + 1]);
      const c = at(t[k * 3 + 2]);
      base.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      const code = paint[k];
      if (code) decodePaint(code, a, b, c, (p, q, r, state) => emit(p, q, r, state || defaultFil));
      else emit(a, b, c, defaultFil);
    }
  };

  for (const item of chosen) {
    const key = `${rootPath}#${item.id}`;
    place(key, item.transform, item.id, settings.objectExtruder.get(item.id) ?? 1, 0);
  }
  if (!cols.length) throw new ThreeMfError("This 3MF file has no triangles to print.");

  const positions = Float32Array.from(pos);
  const triColors = Uint8Array.from(cols, (c) => Math.min(255, Math.max(1, c)));
  const used = [...new Set(triColors)].sort((a, b) => a - b);
  const area: Record<number, number> = {};
  let totalArea = 0;
  for (let t = 0; t < triColors.length; t++) {
    const i = t * 9;
    const ux = positions[i + 3] - positions[i], uy = positions[i + 4] - positions[i + 1], uz = positions[i + 5] - positions[i + 2];
    const vx = positions[i + 6] - positions[i], vy = positions[i + 7] - positions[i + 1], vz = positions[i + 8] - positions[i + 2];
    const a = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    area[triColors[t]] = (area[triColors[t]] ?? 0) + a;
    totalArea += a;
  }
  const shares: Record<number, number> = {};
  for (const n of used) shares[n] = totalArea > 0 ? Math.round(((area[n] ?? 0) / totalArea) * 10000) / 10000 : 1 / used.length;
  return {
    shares,
    profile: colorProfile(positions, triColors), positions, basePositions: Float32Array.from(base), triangleCount: triColors.length, triColors, filaments: readFilaments(files), used, notes };
}
