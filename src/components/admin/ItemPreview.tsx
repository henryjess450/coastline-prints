"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ColorConfig } from "@config/materials";
import { PrintingLoader } from "@/components/motion/PrintingLoader";
import { parseInWorker } from "@/lib/order/client-stl";
import type { OrientationIndex } from "@/lib/printers/fit";
import type { ModelAnalysis } from "@/lib/stl/inspect";

const ModelViewer = dynamic(() => import("@/components/viewer/ModelViewer"), { ssr: false, loading: () => <PrintingLoader label="Loading 3D viewer…" /> });

export type PreviewItem = {
  uploadId: string;
  scale: { x: number; y: number; z: number };
  orientation: number;
  size: { x: number; y: number; z: number };
  color: ColorConfig;
  buildVolume: { x: number; y: number; z: number } | null;
  fileDeleted: boolean;
};

type Loaded = { positions: Float32Array; normals: Float32Array; analysis: ModelAnalysis };

/** Loads the original STL and shows it at the ordered scale and orientation. */
export function ItemPreview({ item }: { item: PreviewItem }) {
  const [state, setState] = useState<{ id: string; data?: Loaded; error?: string } | null>(null);
  const loaded = state?.id === item.uploadId ? state : null;

  useEffect(() => {
    if (item.fileDeleted) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/uploads/${item.uploadId}/file?inline=1`);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't load the file.");
        const r = await parseInWorker(`admin-${item.uploadId}`, await res.arrayBuffer());
        if (!r.ok) throw new Error(r.error);
        if (!cancelled) setState({ id: item.uploadId, data: { positions: r.positions, normals: r.normals, analysis: r.analysis } });
      } catch (err) {
        if (!cancelled) setState({ id: item.uploadId, error: err instanceof Error ? err.message : "Couldn't load the file." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.uploadId, item.fileDeleted]);

  return (
    <div className="relative h-80 overflow-hidden rounded-2xl border border-line bg-[var(--viewer-bg)] sm:h-96">
      {item.fileDeleted ? (
        <p className="grid h-full place-items-center p-6 text-center text-sm text-muted">This file was deleted by the retention cleanup.</p>
      ) : loaded?.error ? (
        <p className="grid h-full place-items-center p-6 text-center text-sm text-danger">{loaded.error}</p>
      ) : loaded?.data ? (
        <ModelViewer
          modelKey={item.uploadId}
          positions={loaded.data.positions}
          normals={loaded.data.normals}
          rawBox={loaded.data.analysis.stats.bbox}
          scale={item.scale}
          orientation={item.orientation as OrientationIndex}
          bedSize={item.size}
          color={item.color}
          buildVolume={item.buildVolume}
          fits
        />
      ) : (
        <div className="grid h-full place-items-center">
          <PrintingLoader label="Loading model…" />
        </div>
      )}
    </div>
  );
}
