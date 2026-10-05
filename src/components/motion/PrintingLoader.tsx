"use client";
import { motion, useReducedMotion } from "framer-motion";

const LAYERS = 9;
const COLORS = ["#0e4471", "#3d7bb8", "#86bbea"];

/**
 * Signature loader: a small vase "prints" layer by layer while the nozzle
 * sweeps back and forth. Used for parsing, pricing and payment.
 */
export function PrintingLoader({ label = "Working…", size = 120 }: { label?: string; size?: number }) {
  const reduce = useReducedMotion();
  const cycle = 2.4;

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <rect x="12" y="84" width="76" height="5" rx="1.5" fill="currentColor" opacity="0.25" />
        {Array.from({ length: LAYERS }, (_, i) => {
          const t = i / (LAYERS - 1);
          const w = 30 + Math.sin(t * Math.PI) * 22;
          const y = 78 - i * 6;
          return (
            <motion.rect
              key={i}
              x={50 - w / 2}
              y={y}
              width={w}
              height={4.6}
              rx={1.2}
              fill={COLORS[i % COLORS.length]}
              initial={{ scaleX: reduce ? 1 : 0, opacity: reduce ? 0.3 : 0 }}
              animate={reduce ? { opacity: [0.3, 1, 0.3] } : { scaleX: [0, 1, 1, 1], opacity: [0, 1, 1, 0] }}
              transition={{
                duration: cycle,
                repeat: Infinity,
                delay: reduce ? i * 0.08 : 0,
                times: reduce ? undefined : [i / LAYERS, (i + 0.8) / LAYERS, 0.9, 1],
                ease: "easeOut",
              }}
              style={{ originX: "50%", transformBox: "fill-box" }}
            />
          );
        })}
        {!reduce && (
          <motion.g
            animate={{ x: [-20, 20, -20], y: [0, -54, -54] }}
            transition={{
              x: { duration: cycle / LAYERS, repeat: Infinity, ease: "easeInOut" },
              y: { duration: cycle, repeat: Infinity, ease: "linear", times: [0, 0.9, 1] },
            }}
          >
            <path d="M43 13h14v8l-7 7-7-7z" fill="currentColor" />
            <circle cx="50" cy="30" r="1.8" fill="#e9c46a" />
          </motion.g>
        )}
      </svg>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}
