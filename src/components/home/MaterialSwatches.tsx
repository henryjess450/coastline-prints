"use client";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { MaterialConfig } from "@config/materials";
import { cn } from "@/lib/cn";

const SwatchPreview = dynamic(() => import("./SwatchPreview"), { ssr: false, loading: () => <div className="h-full w-full" /> });

const finishLabel: Record<string, string> = {
  matte: "Matte",
  solid: "Glossy",
  silk: "Silk sheen",
  translucent: "See-through",
  wood: "Wood fill",
  gradient: "Colour changes along the height",
};

/** One row of swatches per material. Tapping a swatch shows it on the sample. */
export function MaterialSwatches({ materials }: { materials: MaterialConfig[] }) {
  const [pick, setPick] = useState(() => ({ material: materials[0], color: materials[0].colors.find((c) => c.available)! }));

  return (
    <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-surface">
          <SwatchPreview color={pick.color} />
          <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-3">
            <AnimatePresence mode="wait">
              <motion.div key={pick.color.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                <p className="font-semibold">{pick.color.name}</p>
                <p className="text-sm text-muted">
                  {pick.material.name} · {finishLabel[pick.color.finish] ?? pick.color.finish}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <p className="mt-3 text-xs text-faint">Colours on screen are close, not exact. Real spools can look a little different.</p>
      </div>

      <div className="space-y-6">
        {materials.map((m) => {
          const colors = m.colors.filter((c) => c.available);
          if (!colors.length) return null;
          return (
            <div key={m.id} className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
              <h3 className="font-display text-xl font-bold">{m.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{m.description}</p>
              <ul className="mt-6 flex flex-wrap gap-3" aria-label={`${m.name} colours`}>
                {colors.map((c) => {
                  const on = pick.color.id === c.id && pick.material.id === m.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setPick({ material: m, color: c })}
                        aria-pressed={on}
                        aria-label={`${c.name}${c.pricePerGramCents != null ? ", costs a little more per gram" : ""}`}
                        title={c.name}
                        className={cn(
                          "grid h-11 w-11 place-items-center rounded-full border-2 transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow)] active:scale-95",
                          on ? "border-accent-line ring-4 ring-accent-soft" : "border-line-strong",
                        )}
                      >
                        <span className="h-7 w-7 rounded-full" style={{ background: c.finish === "gradient" ? rainbow : c.hex }} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Hard colour stops, so the gradient spool's swatch reads as stripes (no blending).
const rainbow = "conic-gradient(#e2479a 0 25%, #f2c14e 0 50%, #3ccf8e 0 75%, #4f91cc 0)";
