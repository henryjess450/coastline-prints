import { computeMeshStats, computeTopology, type MeshStats, type Topology } from "./analyze";

export type MeshWarningCode =
  | "zero-volume"
  | "open-mesh"
  | "non-manifold"
  | "inverted-normals"
  | "too-small"
  | "too-large"
  | "likely-inches";

export type MeshWarning = { code: MeshWarningCode; severity: "info" | "warning" | "error"; message: string };

export type ModelAnalysis = {
  stats: MeshStats;
  topology: Topology;
  warnings: MeshWarning[];
  /** True when ×25.4 would turn this into a sensible print size. */
  suggestInches: boolean;
};

const INCH = 25.4;
const MIN_SENSIBLE_MM = 3;
const MAX_SENSIBLE_MM = 1000;

export function inspectModel(positions: ArrayLike<number>): ModelAnalysis {
  const stats = computeMeshStats(positions);
  const topology = computeTopology(positions);
  const warnings: MeshWarning[] = [];
  const { x, y, z } = stats.bbox.size;
  const maxDim = Math.max(x, y, z);

  if (stats.volumeMm3 < 1e-3) {
    warnings.push({ code: "zero-volume", severity: "error", message: "This model has no volume (it may be a flat surface), so it can't be printed as-is." });
  }
  if (topology.boundaryEdges > 0) {
    warnings.push({
      code: "open-mesh",
      severity: "warning",
      message: `The mesh has holes (${topology.boundaryEdges.toLocaleString()} open edges). It may still print, but volume and price estimates could be off.`,
    });
  }
  if (topology.nonManifoldEdges > 0) {
    warnings.push({
      code: "non-manifold",
      severity: "warning",
      message: `The mesh has ${topology.nonManifoldEdges.toLocaleString()} non-manifold edges. We'll review it before printing.`,
    });
  }
  if (stats.signedVolumeMm3 < -1e-3) {
    warnings.push({ code: "inverted-normals", severity: "info", message: "Faces are wound inside-out. We'll fix this automatically when slicing." });
  }

  // Real prints under ~7 mm are rare; inch models of 0.4 to 7 units land at 10 to 180 mm.
  const suggestInches = maxDim > 0 && maxDim < 7 && maxDim * INCH >= 10;
  if (suggestInches) {
    warnings.push({
      code: "likely-inches",
      severity: "warning",
      message: `At ${maxDim.toFixed(2)} mm across, this looks like it was modelled in inches.`,
    });
  } else if (maxDim > 0 && maxDim < MIN_SENSIBLE_MM) {
    warnings.push({ code: "too-small", severity: "warning", message: "This model is tiny (under 3 mm). Check the units or scale it up." });
  }
  if (maxDim > MAX_SENSIBLE_MM) {
    warnings.push({ code: "too-large", severity: "warning", message: "This model is over 1 m across. It may be in the wrong units; scale it down to fit a printer." });
  }

  return { stats, topology, warnings, suggestInches };
}

export const INCHES_TO_MM = INCH;
