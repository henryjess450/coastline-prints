/// <reference lib="webworker" />
/**
 * Parses an STL off the main thread with three.js STLLoader, computes flat
 * normals and runs the shared analysis. Positions/normals are transferred
 * back (zero-copy) for the viewer.
 */
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { detectStlFormat } from "@/lib/stl/parse";
import { inspectModel } from "@/lib/stl/inspect";

export type WorkerRequest = { id: string; buffer: ArrayBuffer };
export type WorkerResponse =
  | { id: string; ok: true; positions: Float32Array; normals: Float32Array; analysis: ReturnType<typeof inspectModel> }
  | { id: string; ok: false; error: string };

const loader = new STLLoader();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, buffer } = event.data;
  try {
    if (!detectStlFormat(new Uint8Array(buffer))) throw new Error("This doesn't look like an STL file.");
    const geometry = loader.parse(buffer);
    geometry.computeVertexNormals(); // non-indexed → flat face normals
    const positions = geometry.getAttribute("position").array as Float32Array;
    const normals = geometry.getAttribute("normal").array as Float32Array;
    if (positions.length < 9) throw new Error("The STL file contains no triangles.");
    const analysis = inspectModel(positions);
    const res: WorkerResponse = { id, ok: true, positions, normals, analysis };
    (self as unknown as Worker).postMessage(res, [positions.buffer, normals.buffer]);
  } catch (err) {
    const res: WorkerResponse = { id, ok: false, error: err instanceof Error ? err.message : "We couldn't read this file." };
    (self as unknown as Worker).postMessage(res);
  }
};
