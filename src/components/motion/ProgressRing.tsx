"use client";
import { motion } from "framer-motion";

export function ProgressRing({ value, size = 44, stroke = 4, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="relative inline-grid place-items-center" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - value) }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </svg>
      <span className="absolute font-mono text-[10px] tabular-nums text-muted">{pct}%</span>
    </div>
  );
}
