"use client";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function inputClass(error?: string, flash?: boolean) {
  return cn(
    "h-11 w-full rounded-xl border bg-surface px-3.5 pr-10 text-sm text-fg outline-none transition-[border-color,box-shadow] duration-500 placeholder:text-faint focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]",
    error ? "border-danger/60" : flash ? "border-accent-line shadow-[0_0_0_4px_var(--accent-soft)]" : "border-line",
  );
}

export function Field({ id, label, error, valid, className, children }: { id: string; label: string; error?: string; valid?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        {children}
        {/* A small tick pops in once the field looks right */}
        <AnimatePresence>
          {valid && !error && (
            <motion.span
              className="pointer-events-none absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-success/15 text-success"
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              aria-hidden
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <motion.path d="M5 13l4 4L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.1, duration: 0.25 }} />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            id={`${id}-err`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, x: [0, -4, 4, -2, 0] }}
            exit={{ opacity: 0 }}
            className="mt-1.5 text-xs text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
