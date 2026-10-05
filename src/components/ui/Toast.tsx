"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { create } from "zustand";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };

const useToasts = create<{ toasts: Toast[]; push: (message: string, tone: Tone) => void; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  push: (message, tone) => set((s) => ({ toasts: [...s.toasts.slice(-3), { id: Date.now() + Math.random(), message, tone }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Show a short notice in the corner, e.g. toast("Pricing saved"). */
export function toast(message: string, tone: Tone = "success") {
  useToasts.getState().push(message, tone);
}

/** Notices slide in from the bottom right and leave on their own after a few seconds. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6" aria-live="polite" role="status">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast: t }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    const id = window.setTimeout(() => dismiss(t.id), 3800);
    return () => window.clearTimeout(id);
  }, [t.id, dismiss]);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-elev px-4 py-3 text-sm shadow-[var(--shadow)]"
    >
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold",
          t.tone === "success" && "bg-success/20 text-success",
          t.tone === "error" && "bg-danger/20 text-danger",
          t.tone === "info" && "bg-accent-soft text-accent-text",
        )}
        aria-hidden
      >
        {t.tone === "success" ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 13l4 4L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.15, duration: 0.25 }} />
          </svg>
        ) : t.tone === "error" ? (
          "!"
        ) : (
          "i"
        )}
      </span>
      <span className="text-fg">{t.message}</span>
      <button type="button" onClick={() => dismiss(t.id)} className="ml-1 text-faint hover:text-fg" aria-label="Dismiss">
        ×
      </button>
    </motion.div>
  );
}
