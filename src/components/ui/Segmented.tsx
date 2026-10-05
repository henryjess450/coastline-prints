"use client";
import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/cn";

export type SegmentOption<T extends string> = { value: T; label: string; hint?: string };

/** Accessible radio group drawn as a row of blocks with a sliding solid highlight. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full gap-1 rounded-full border-2 border-line bg-surface p-1">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (!dir) return;
              e.preventDefault();
              const n = (i + dir + options.length) % options.length;
              onChange(options[n].value);
              (e.currentTarget.parentElement?.children[n] as HTMLElement)?.focus();
            }}
            className={cn(
              "relative flex-1 px-2 py-1.5 text-sm font-medium transition-colors",
              active ? "text-accent-ink" : "text-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 520, damping: 34 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
