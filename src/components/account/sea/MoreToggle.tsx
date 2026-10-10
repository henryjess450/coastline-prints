"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

/** A quiet link that opens the extra bits of a section (history, a form) in place. */
export function MoreToggle({ label, openLabel = "Hide", children, className }: { label: string; openLabel?: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="group inline-flex items-center gap-1.5 text-sm font-medium text-accent-text">
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="inline-block" aria-hidden>
          ›
        </motion.span>
        <span className="underline-offset-4 group-hover:underline">{open ? openLabel : label}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="overflow-hidden">
            <div className="pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
