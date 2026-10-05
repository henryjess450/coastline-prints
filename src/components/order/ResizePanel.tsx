"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useConfig } from "@/components/ConfigProvider";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import { cn } from "@/lib/cn";
import type { ItemDerived } from "@/lib/order/derive";
import { isUniform, useOrder, type CartItem } from "@/lib/order/store";

const LOG_MIN = 0; // 10^0 = 1%
const LOG_MAX = 3; // 10^3 = 1000%

export function ResizePanel({ item, derived }: { item: CartItem; derived: ItemDerived }) {
  const s = useOrder();
  const cfg = useConfig();
  const size = derived.size;
  if (!size) return null;

  const uniform = isUniform(item.scale);
  const pct = item.scale.x * 100;
  const sliderVal = Math.min(1000, Math.max(0, ((Math.log10(pct) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000));
  const fits = derived.assignment?.ok ?? true;
  const notFitting = derived.assignment && !derived.assignment.ok && derived.assignment.reason === "too-large" ? derived.assignment : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor={`scale-${item.key}`} className="text-sm font-medium text-fg">
            Scale
          </label>
          <span className="font-mono text-xs tabular-nums text-muted">{uniform ? `${pct.toFixed(1)}%` : "Custom proportions"}</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            id={`scale-${item.key}`}
            type="range"
            min={0}
            max={1000}
            step={1}
            value={sliderVal}
            onChange={(e) => s.setUniformScale(item.key, Math.pow(10, LOG_MIN + (Number(e.target.value) / 1000) * (LOG_MAX - LOG_MIN)) / 100)}
            className="range w-full"
            style={{ ["--fill" as string]: `${sliderVal / 10}%` }}
            aria-valuetext={`${pct.toFixed(0)} percent`}
          />
          <NumberField
            label="Percent"
            srLabel="Scale percent"
            className="w-24 [&>span:first-child]:sr-only"
            value={pct}
            suffix="%"
            min={1}
            max={5000}
            onCommit={(v) => s.setUniformScale(item.key, v / 100)}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-fg">Dimensions</span>
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => s.update(item.key, { lockAspect: !item.lockAspect })}
            aria-pressed={item.lockAspect}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-medium transition-colors",
              item.lockAspect ? "border-accent-line bg-accent-soft text-fg" : "border-line text-muted hover:text-fg",
            )}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <motion.path d="M8 11V8a4 4 0 0 1 8 0" animate={{ rotate: item.lockAspect ? 0 : -25, x: item.lockAspect ? 0 : -2 }} style={{ originX: "16px", originY: "11px" }} />
            </svg>
            {item.lockAspect ? "Proportions locked" : "Proportions unlocked"}
          </motion.button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <NumberField
              key={axis}
              label={axis.toUpperCase()}
              srLabel={`${axis.toUpperCase()} size in millimetres`}
              value={size[axis]}
              suffix="mm"
              min={1}
              max={5000}
              invalid={!fits}
              onCommit={(v) => s.setDimension(item.key, axis, v)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => s.fitToMax(item.key, cfg)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
          Fit to max size
        </Button>
        <Button size="sm" variant="ghost" onClick={() => s.resetSize(item.key)}>
          Reset
        </Button>
        <Button size="sm" variant="ghost" onClick={() => s.toggleInches(item.key)} aria-pressed={item.unitFactor !== 1}>
          {item.unitFactor !== 1 ? "Undo inches fix" : "Modelled in inches?"}
        </Button>
      </div>

      <AnimatePresence>
        {notFitting && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ x: { duration: 0.45 } }}
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm"
          >
            <p className="text-danger">{notFitting.message}</p>
            {notFitting.maxScale ? (
              <Button size="sm" variant="danger" className="mt-2" onClick={() => s.fitToMax(item.key, cfg)}>
                Scale down to fit ({Math.floor(notFitting.maxScale * 999) / 10}% of current)
              </Button>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
