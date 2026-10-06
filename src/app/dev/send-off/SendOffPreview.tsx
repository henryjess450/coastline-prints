"use client";
import { useMemo, useState } from "react";
import { OrderAnimation, type PayResult } from "@/components/checkout/OrderAnimation";
import { makeVaseGeometry } from "@/lib/home/vase";
import { modelSilhouette } from "@/lib/order/silhouette";

/** Sample model: the home page vase, turned Z-up like an STL. */
function samplePositions() {
  const g = makeVaseGeometry("low").toNonIndexed();
  const p = g.getAttribute("position").array as Float32Array;
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    out[i] = p[i];
    out[i + 1] = p[i + 2];
    out[i + 2] = p[i + 1];
  }
  return out;
}

export function SendOffPreview() {
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<PayResult>("pending");
  const model = useMemo(() => (typeof document === "undefined" ? null : modelSilhouette(samplePositions(), "#2e9e4b")), []);
  const start = () => {
    setResult("pending");
    setRun((n) => n + 1);
    window.setTimeout(() => setResult("paid"), 2500); // pretend Square answered
  };
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold">Order send-off preview</h1>
      <p className="mt-2 text-muted">Development only. No payment is made.</p>
      <button type="button" onClick={start} className="btn btn-primary mt-8 h-12 px-6">
        Play
      </button>
      {run > 0 && <OrderAnimation key={run} result={result} fileName="dragon-keychain.stl" model={model} color="#2e9e4b" onDone={() => setRun(0)} />}
    </div>
  );
}
