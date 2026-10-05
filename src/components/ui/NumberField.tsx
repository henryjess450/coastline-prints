"use client";
import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Number input that lets the user type freely and commits on blur/Enter,
 * so partially typed values ("1.") don't fight the live model. When the value
 * changes from elsewhere (slider, fit to max) the number ticks to it.
 */
export function NumberField({
  label,
  value,
  onCommit,
  suffix,
  decimals = 1,
  min,
  max,
  className,
  invalid,
  srLabel,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  suffix?: string;
  decimals?: number;
  min?: number;
  max?: number;
  className?: string;
  invalid?: boolean;
  srLabel?: string;
}) {
  // Only holds text while the field is being edited; otherwise shows `value`.
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const shown = useTicker(value);

  /** Reads the input's own value so a stale render can't drop an edit. */
  function commit(raw: string) {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }
    const n = Number(raw.replace(",", "."));
    if (Number.isFinite(n) && n > 0 && raw !== format(value, decimals)) onCommit(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
    setDraft(null);
  }

  return (
    <label className={cn("group block", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <span
        className={cn(
          "flex items-center rounded-xl border bg-surface px-3 transition-[border-color,box-shadow] focus-within:border-accent-line focus-within:shadow-[0_0_0_4px_var(--accent-soft)]",
          invalid ? "border-danger/60" : "border-line",
        )}
      >
        <input
          inputMode="decimal"
          aria-label={srLabel ?? label}
          aria-invalid={invalid || undefined}
          value={draft ?? format(shown, decimals)}
          onFocus={(e) => {
            setDraft(format(value, decimals));
            e.currentTarget.select();
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              cancelled.current = true;
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="h-10 w-full min-w-0 bg-transparent font-mono text-sm tabular-nums text-fg outline-none"
        />
        {suffix && <span className="pl-1 text-xs text-faint">{suffix}</span>}
      </span>
    </label>
  );
}

const format = (v: number, d: number) => (Number.isFinite(v) ? Number(v.toFixed(d)).toString() : "");

/** Follows `value`, easing over a short moment instead of jumping. */
function useTicker(value: number) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce || !Number.isFinite(from.current) || !Number.isFinite(value)) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);
  return shown;
}
