/// <reference lib="webworker" />
/**
 * Builds the ghost tree supports for the 3D preview off the main thread.
 * Keeps the last few models' triangles so changing size or orientation only
 * sends a small message.
 */
import { supports as supportCfg } from "@config/pricing";
import { orientationMatrix, type OrientationIndex } from "@/lib/printers/fit";
import { buildSupportTree } from "@/lib/model/support-geometry";
import type { Vec3 } from "@/lib/stl/analyze";

export type SupportRequest = {
  id: number;
  key: string;
  /** Sent the first time for each model (the worker keeps it). */
  positions?: Float32Array;
  orientation: OrientationIndex;
  scale: Vec3;
  /** Centre of the raw bounding box (the preview centres the model on it). */
  center: Vec3;
  /** Printed height, mm. */
  height: number;
};
export type SupportResponse = { id: number; key: string; segments: Float32Array } | { id: number; key: string; missing: true };

const models = new Map<string, Float32Array>();

self.onmessage = (event: MessageEvent<SupportRequest>) => {
  const { id, key, positions, orientation, scale, center, height } = event.data;
  if (positions) {
    models.set(key, positions);
    while (models.size > 4) models.delete(models.keys().next().value!);
  }
  const src = models.get(key);
  if (!src) return (self as unknown as Worker).postMessage({ id, key, missing: true } satisfies SupportResponse);

  // Same placement as the preview: centre, scale, rotate, then sit on the bed.
  const m = orientationMatrix(orientation);
  const placed = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = (src[i] - center.x) * scale.x;
    const y = (src[i + 1] - center.y) * scale.y;
    const z = (src[i + 2] - center.z) * scale.z;
    placed[i] = m[0] * x + m[1] * y + m[2] * z;
    placed[i + 1] = m[3] * x + m[4] * y + m[5] * z;
    placed[i + 2] = m[6] * x + m[7] * y + m[8] * z + height / 2;
  }
  const segments = buildSupportTree(placed, { thresholdDeg: supportCfg.thresholdDeg });
  (self as unknown as Worker).postMessage({ id, key, segments } satisfies SupportResponse, [segments.buffer]);
};
