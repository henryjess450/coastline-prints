"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export const STEPS = ["Upload", "Customize", "Checkout", "Done"] as const;

export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Order progress" className="w-full">
      <ol className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((label, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-none sm:gap-3" aria-current={state === "current" ? "step" : undefined}>
              <span className="flex items-center gap-2">
                <motion.span
                  className={cn(
                    "relative grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold",
                    state === "todo" ? "border-line text-faint" : "bg-accent text-accent-ink",
                  )}
                  animate={state === "current" ? { rotate: [0, -6, 6, 0], scale: 1.08 } : { rotate: 0, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  {state === "done" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden>
                      <motion.path d="M5 13l4 4L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </motion.span>
                <span className={cn("hidden text-sm sm:inline", state === "todo" ? "text-faint" : "font-medium text-fg")}>{label}</span>
                <span className="sr-only">{state === "done" ? "(completed)" : state === "current" ? "(current step)" : ""}</span>
              </span>
              {i < STEPS.length - 1 && (
                <span className="relative h-1 flex-1 overflow-hidden rounded-sm bg-line" aria-hidden>
                  <motion.span
                    className="absolute inset-y-0 left-0 bg-accent"
                    initial={false}
                    animate={{ width: i < current ? "100%" : "0%" }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
