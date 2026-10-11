"use client";
import { cn } from "@/lib/cn";

/** − 2 + */
export function QuantityStepper({ value, max, onChange, size = "md" }: { value: number; max: number; onChange: (v: number) => void; size?: "sm" | "md" }) {
  const btn = cn("grid place-items-center rounded-full text-lg leading-none transition-[background-color,transform] hover:bg-surface-strong active:scale-90 disabled:opacity-30", size === "sm" ? "h-8 w-8" : "h-11 w-11");
  return (
    <div className="inline-flex items-center rounded-full border border-line">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="One fewer">
        −
      </button>
      <span className={cn("text-center font-mono tabular-nums", size === "sm" ? "w-7 text-sm" : "w-9")} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="One more">
        +
      </button>
    </div>
  );
}
