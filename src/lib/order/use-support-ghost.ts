"use client";
import { useEffect, useRef, useState } from "react";
import type { SupportRequest, SupportResponse } from "@/workers/supports.worker";
import type { OrientationIndex } from "@/lib/printers/fit";
import type { BoundingBox, Vec3 } from "@/lib/stl/analyze";

let worker: Worker | null = null;
const sent = new WeakSet<Float32Array>();
const listeners = new Map<number, (r: SupportResponse) => void>();
let seq = 0;

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("../../workers/supports.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<SupportResponse>) => {
      listeners.get(e.data.id)?.(e.data);
      listeners.delete(e.data.id);
    };
  }
  return worker;
}

/**
 * Ghost tree supports for the preview, rebuilt (debounced, off the main
 * thread) when the model, size or orientation changes. Null while building
 * or when turned off.
 */
export function useSupportGhost(opts: { key: string; positions: Float32Array | undefined; rawBox: BoundingBox | undefined; scale: Vec3; orientation: OrientationIndex; height: number; enabled: boolean }) {
  const { key, positions, rawBox, scale, orientation, height, enabled } = opts;
  const [result, setResult] = useState<{ sig: string; segments: Float32Array } | null>(null);
  const sig = positions && rawBox ? `${key}|${orientation}|${scale.x.toFixed(4)}|${scale.y.toFixed(4)}|${scale.z.toFixed(4)}` : "";
  const latest = useRef(sig);
  useEffect(() => {
    latest.current = sig;
  });

  useEffect(() => {
    if (!enabled || !sig || !positions || !rawBox) return;
    const t = setTimeout(() => {
      const send = (withPositions: boolean) => {
        const id = ++seq;
        const msg: SupportRequest = {
          id,
          key,
          orientation,
          scale,
          height,
          center: { x: (rawBox.min.x + rawBox.max.x) / 2, y: (rawBox.min.y + rawBox.max.y) / 2, z: (rawBox.min.z + rawBox.max.z) / 2 },
        };
        if (withPositions) {
          msg.positions = positions.slice();
          sent.add(positions);
        }
        listeners.set(id, (r) => {
          if ("missing" in r) return send(true);
          if (latest.current === sig) setResult({ sig, segments: r.segments });
        });
        getWorker().postMessage(msg, msg.positions ? [msg.positions.buffer] : []);
      };
      send(!sent.has(positions));
    }, 250);
    return () => clearTimeout(t);
  }, [enabled, sig, key, positions, rawBox, orientation, scale, height]);

  return enabled && result?.sig === sig ? result.segments : null;
}
