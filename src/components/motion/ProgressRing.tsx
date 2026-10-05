"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

/**
 * Upload progress as a little porthole filling with water. The wave on the
 * surface drifts while it fills.
 */
export function ProgressRing({ value, size = 44, label }: { value: number; size?: number; label?: string }) {
  const id = useId().replace(/[^\w-]/g, "");
  const reduce = useReducedMotion();
  const v = Math.min(1, Math.max(0, value));
  const pct = Math.round(v * 100);
  const r = size / 2;
  const level = size * (1 - v);
  // A wave twice the width of the circle, slid left by one width forever.
  const wave = `M0 ${level} q${size / 8} -4 ${size / 4} 0 t${size / 4} 0 t${size / 4} 0 t${size / 4} 0 t${size / 4} 0 t${size / 4} 0 t${size / 4} 0 t${size / 4} 0 V${size} H0 Z`;
  return (
    <div className="relative inline-grid shrink-0 place-items-center" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <svg width={size} height={size}>
        <defs>
          <clipPath id={`pr-${id}`}>
            <circle cx={r} cy={r} r={r - 3} />
          </clipPath>
        </defs>
        <circle cx={r} cy={r} r={r - 1.5} fill="var(--surface-strong)" stroke="var(--accent-line)" strokeWidth="3" />
        <g clipPath={`url(#pr-${id})`}>
          <motion.path
            d={wave}
            fill="var(--accent-line)"
            initial={false}
            animate={{ x: reduce ? 0 : [0, -size], d: wave }}
            transition={{ x: { duration: 1.6, repeat: Infinity, ease: "linear" }, d: { type: "spring", stiffness: 120, damping: 20 } }}
          />
        </g>
      </svg>
      <span className="absolute font-mono text-[10px] font-semibold tabular-nums text-fg">{pct}%</span>
    </div>
  );
}
