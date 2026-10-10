"use client";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useSupportGhost } from "@/lib/order/use-support-ghost";
import { useConfig } from "@/components/ConfigProvider";
import { filePalette } from "@/lib/model/palette";
import { PrintingLoader } from "@/components/motion/PrintingLoader";
import type { ItemDerived } from "@/lib/order/derive";
import type { CartItem } from "@/lib/order/store";

const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <PrintingLoader label="Loading the 3D viewer…" />
    </div>
  ),
});

export function ViewerPanel({ item, derived }: { item: CartItem | undefined; derived: ItemDerived | null }) {
  const ready = item?.positions && item.normals && item.analysis && derived?.size;
  const assignment = derived?.assignment;
  const orientation = assignment?.ok ? assignment.orientation : 0;
  const bedSize = assignment?.ok ? assignment.orientedSize : derived?.size;
  // Painted 3MF printed in colour: show each part in the stock colour it was matched to.
  const cfg = useConfig();
  const fc = item?.fileColors;
  const map = item?.colorMap;
  const material = item?.material;
  const paint = useMemo(() => {
    if (!fc || !map || fc.used.length < 2) return null;
    const stock = cfg.materials.find((m) => m.id === material)?.colors ?? [];
    const fileHex = filePalette(fc.filaments, fc.used);
    const palette: Record<number, string> = {};
    for (const n of fc.used) palette[n] = stock.find((c) => c.id === map[n])?.hex ?? fileHex[n];
    return { triColors: fc.triColors, palette };
  }, [fc, map, material, cfg]);

  // Ghost tree supports, rebuilt for the current size and orientation.
  const [showSupports, setShowSupports] = useState(true);
  const viewScale = useMemo(
    () => (item ? { x: item.scale.x * item.unitFactor, y: item.scale.y * item.unitFactor, z: item.scale.z * item.unitFactor } : { x: 1, y: 1, z: 1 }),
    [item],
  );
  const supports = useSupportGhost({
    key: item?.key ?? "",
    positions: item?.positions,
    rawBox: item?.analysis?.stats.bbox,
    scale: viewScale,
    orientation,
    height: bedSize?.z ?? 0,
    enabled: showSupports && cfg.supports.enabled,
  });
  const hasSupports = (derived?.assignment?.ok ? (item?.upload?.supportInfo ?? item?.supports)?.dirs[orientation]?.volumeMm3 ?? 0 : 0) > 0;

  return (
    <div
      className="relative h-[52vh] min-h-[340px] w-full overflow-hidden rounded-3xl border border-line bg-[var(--viewer-bg)] lg:h-[calc(100vh-11rem)] lg:min-h-[520px]"
    >
      <AnimatePresence mode="wait">
        {ready && item && derived && bedSize ? (
          // One persistent canvas: switching files swaps the model (with its
          // own reveal animation) instead of re-creating the WebGL context.
          <motion.div key="viewer" className="absolute inset-0" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <ModelViewer
              modelKey={item.key + ":" + item.unitFactor}
              positions={item.positions!}
              normals={item.normals!}
              rawBox={item.analysis!.stats.bbox}
              scale={{ x: item.scale.x * item.unitFactor, y: item.scale.y * item.unitFactor, z: item.scale.z * item.unitFactor }}
              orientation={orientation}
              bedSize={bedSize}
              color={derived.color}
              buildVolume={derived.displayVolume}
              fits={assignment?.ok ?? true}
              paint={paint}
              supports={supports}
            />
          </motion.div>
        ) : (
          <motion.div key="loading" className="absolute inset-0 grid place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {item?.phase === "error" ? (
              <p className="max-w-xs text-center text-sm text-danger">{item.error}</p>
            ) : (
              <PrintingLoader label="Reading your model…" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay chips */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
        <AnimatePresence>
          {assignment?.ok && (
            <motion.span
              key={assignment.printer.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-full border border-line bg-bg/80 px-3 py-1 text-xs font-medium text-fg backdrop-blur"
            >
              {assignment.printer.name} · {assignment.printer.buildVolume.x}³ mm
            </motion.span>
          )}
          {assignment?.ok && assignment.autoOriented && (
            <motion.span key="rot" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-black">
              Auto-rotated to fit
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {ready && hasSupports && cfg.supports.enabled && (
        <button
          type="button"
          role="switch"
          aria-checked={showSupports}
          onClick={() => setShowSupports((v) => !v)}
          className="absolute bottom-3 left-4 flex items-center gap-2 rounded-full border border-line bg-bg/80 px-3 py-1.5 text-xs font-medium backdrop-blur transition-[transform] active:scale-95"
        >
          <span className={`relative h-4 w-7 rounded-full transition-colors ${showSupports ? "bg-accent" : "bg-surface-strong"}`} aria-hidden>
            <motion.span className="absolute top-0.5 h-3 w-3 rounded-full bg-white" animate={{ left: showSupports ? 14 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
          </span>
          Supports
        </button>
      )}
      <p className="pointer-events-none absolute bottom-4 right-5 text-[11px] text-faint">Drag to orbit · pinch or scroll to zoom</p>
    </div>
  );
}
