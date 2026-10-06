"use client";
import { useEffect, useMemo, useState } from "react";
import { OrderAnimation, type PayResult } from "@/components/checkout/OrderAnimation";
import { makeVaseGeometry } from "@/lib/home/vase";
import { modelSilhouette, type Silhouette } from "@/lib/order/silhouette";
import { parseStl } from "@/lib/stl/parse";

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
  const sample = useMemo(() => (typeof document === "undefined" ? null : modelSilhouette(samplePositions(), "#2e9e4b")), []);
  // Try your own STL (or ?url=/file.stl): same drawing code as checkout, timed.
  const [own, setOwn] = useState<{ model: Silhouette | null; name: string; triangles: number; ms: number } | null>(null);
  const [error, setError] = useState("");
  async function load(buffer: ArrayBuffer, name: string) {
    try {
      const parsed = parseStl(buffer);
      const t0 = performance.now();
      const model = modelSilhouette(parsed.positions, "#2e9e4b");
      setOwn({ model, name, triangles: parsed.positions.length / 9, ms: Math.round(performance.now() - t0) });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => {
    const url = new URLSearchParams(window.location.search).get("url");
    if (url) void fetch(url).then((r) => r.arrayBuffer()).then((b) => load(b, url.split("/").pop() ?? "file.stl"));
  }, []);
  const model = own ? own.model : sample;
  const start = () => {
    setResult("pending");
    setRun((n) => n + 1);
    window.setTimeout(() => setResult("paid"), 2500); // pretend Square answered
  };
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold">Order send-off preview</h1>
      <p className="mt-2 text-muted">Development only. No payment is made.</p>
      <label className="mt-8 block text-sm text-muted">
        Use your own STL:{" "}
        <input type="file" accept=".stl" onChange={(e) => e.target.files?.[0]?.arrayBuffer().then((b) => load(b, e.target.files![0].name))} />
      </label>
      {own && (
        <p className="mt-3 text-sm" data-testid="silhouette-timing">
          {own.name}: {own.triangles.toLocaleString()} triangles, drawn in {own.ms} ms
        </p>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button type="button" onClick={start} className="btn btn-primary mt-8 h-12 px-6">
        Play
      </button>
      {run > 0 && <OrderAnimation key={run} result={result} fileName={own?.name ?? "dragon-keychain.stl"} model={model} color="#2e9e4b" onDone={() => setRun(0)} />}
    </div>
  );
}
