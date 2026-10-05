"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export const STEPS = ["Upload", "Customize", "Checkout", "Done"] as const;

/** Order progress: the line fills to the current step, which pops when reached. */
export function Stepper({ current }: { current: number }) {
  const last = STEPS.length - 1;
  const at = (i: number) => `${(i / last) * 100}%`;
  return (
    <nav aria-label="Order progress" className="w-full px-4">
      <div className="relative">
        {/* Track and the filled part behind it */}
        <span className="absolute inset-x-0 top-4 h-1 -translate-y-1/2 rounded-full bg-line" aria-hidden />
        <motion.span
          className="absolute left-0 top-4 h-1 -translate-y-1/2 rounded-full bg-accent-line"
          initial={false}
          animate={{ width: at(current) }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
          aria-hidden
        />
        <ol className="relative flex justify-between">
          {STEPS.map((label, i) => {
            const state = i < current ? "done" : i === current ? "current" : "todo";
            return (
              <li key={label} className="flex w-8 flex-col items-center" aria-current={state === "current" ? "step" : undefined}>
                <motion.span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold transition-colors duration-300",
                    state === "todo" ? "border-line bg-bg text-faint" : "border-accent-line bg-accent text-accent-ink",
                  )}
                  initial={false}
                  animate={state === "current" ? { scale: [1, 1.18, 1.06] } : { scale: 1 }}
                  transition={{ duration: 0.45 }}
                >
                  {state === "done" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <motion.path d="M5 13l4 4L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.15 }} />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </motion.span>
                <span aria-hidden className={cn("mt-2 hidden whitespace-nowrap text-sm sm:block", state === "todo" ? "text-faint" : "font-medium text-fg")}>{label}</span>
                <span className="sr-only">
                  {label} {state === "done" ? "(completed)" : state === "current" ? "(current step)" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
