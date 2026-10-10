/**
 * Reads any supported model file (STL or 3MF), by content not extension.
 * Pure: used by the browser worker, the upload route and pricing.
 */
import { parseStl, StlParseError, type StlFormat } from "@/lib/stl/parse";
import { supports as supportCfg } from "@config/pricing";
import { supportProfile, type SupportProfile } from "./supports";
import { isZip, parse3mf, ThreeMfError, type ColorProfile, type Filament } from "./threemf";

export type ModelFormat = StlFormat | "3mf";

export type ParsedModel = {
  format: ModelFormat;
  positions: Float32Array;
  /** What to run mesh checks on (3MF: without paint splits). */
  checkPositions: Float32Array;
  triangleCount: number;
  /** 3MF only: filament number (1-based) per triangle, the project's filaments and which are used. */
  colors: { triColors: Uint8Array; filaments: Filament[]; used: number[]; shares: Record<number, number>; profile: ColorProfile } | null;
  notes: string[];
  /** Overhangs that need support, for each way up (from the unsplit mesh). */
  supports: SupportProfile;
};

export class ModelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelParseError";
  }
}

export function parseModel(input: ArrayBuffer | Uint8Array): ParsedModel {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  try {
    if (isZip(bytes)) {
      const r = parse3mf(bytes);
      return { format: "3mf", supports: supportProfile(r.basePositions, supportCfg.thresholdDeg), positions: r.positions, checkPositions: r.basePositions, triangleCount: r.triangleCount, colors: { triColors: r.triColors, filaments: r.filaments, used: r.used, shares: r.shares, profile: r.profile }, notes: r.notes };
    }
    const s = parseStl(bytes);
    return { format: s.format, supports: supportProfile(s.positions, supportCfg.thresholdDeg), positions: s.positions, checkPositions: s.positions, triangleCount: s.triangleCount, colors: null, notes: [] };
  } catch (err) {
    if (err instanceof StlParseError || err instanceof ThreeMfError) throw new ModelParseError(err.message.replace("doesn't look like an STL file", "doesn't look like an STL or 3MF file"));
    throw err;
  }
}

/** File extension for storing an upload of this format. */
export const extensionFor = (format: string) => (format === "3mf" ? "3mf" : "stl");

/** The colour summary saved with an upload (no per-triangle data). */
export type ColorInfo = { filaments: Filament[]; used: number[]; notes: string[]; shares?: Record<number, number>; profile?: ColorProfile };
