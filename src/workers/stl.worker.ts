/// <reference lib="webworker" />
/**
 * Parses an STL or 3MF off the main thread, computes flat normals and runs
 * the shared analysis. Positions/normals (and 3MF colours) are transferred
 * back (zero-copy) for the viewer.
 */
import { ModelParseError, parseModel } from "@/lib/model/parse";
import type { ColorProfile, Filament } from "@/lib/model/threemf";
import type { SupportProfile } from "@/lib/model/supports";
import { inspectModel } from "@/lib/stl/inspect";

export type WorkerRequest = { id: string; buffer: ArrayBuffer };
export type WorkerResponse =
  | {
      id: string;
      ok: true;
      positions: Float32Array;
      normals: Float32Array;
      analysis: ReturnType<typeof inspectModel>;
      /** 3MF only: filament number per triangle, and the project's filaments. */
      colors: { triColors: Uint8Array; filaments: Filament[]; used: number[]; shares: Record<number, number>; profile: ColorProfile } | null;
      supports: SupportProfile;
    }
  | { id: string; ok: false; error: string };

/** Flat (per-face) normals for a triangle soup. */
function flatNormals(p: Float32Array) {
  const n = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 9) {
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
    const vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2];
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    const len = Math.hypot(x, y, z) || 1;
    x /= len;
    y /= len;
    z /= len;
    for (let k = 0; k < 9; k += 3) {
      n[i + k] = x;
      n[i + k + 1] = y;
      n[i + k + 2] = z;
    }
  }
  return n;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, buffer } = event.data;
  try {
    const parsed = parseModel(buffer);
    const positions = parsed.positions;
    if (positions.length < 9) throw new Error("The file contains no triangles.");
    const normals = flatNormals(positions);
    const analysis = inspectModel(parsed.checkPositions);
    for (const note of parsed.notes) analysis.warnings.push({ code: "file-note", severity: "info", message: note });
    const res: WorkerResponse = { id, ok: true, positions, normals, analysis, colors: parsed.colors, supports: parsed.supports };
    const transfer: Transferable[] = [positions.buffer, normals.buffer];
    if (parsed.colors) transfer.push(parsed.colors.triColors.buffer);
    (self as unknown as Worker).postMessage(res, transfer);
  } catch (err) {
    const message = err instanceof ModelParseError || err instanceof Error ? err.message : "We couldn't read this file.";
    const res: WorkerResponse = { id, ok: false, error: message };
    (self as unknown as Worker).postMessage(res);
  }
};
