"use client";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
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

  return (
    <div
      className="relative h-[52vh] min-h-[340px] w-full overflow-hidden rounded-3xl border-2 border-line bg-[var(--viewer-bg)] lg:h-[calc(100vh-11rem)] lg:min-h-[520px]"
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
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <AnimatePresence>
          {assignment?.ok && (
            <motion.span
              key={assignment.printer.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-md border border-line bg-bg/80 px-2.5 py-1 text-xs font-medium text-fg backdrop-blur"
            >
              {assignment.printer.name} · {assignment.printer.buildVolume.x}³ mm
            </motion.span>
          )}
          {assignment?.ok && assignment.autoOriented && (
            <motion.span key="rot" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-md  bg-sand px-2.5 py-0.5 text-xs font-semibold text-black">
              Auto-rotated to fit
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <p className="pointer-events-none absolute bottom-3 right-4 text-[11px] text-faint">Drag to orbit · pinch or scroll to zoom</p>
    </div>
  );
}
