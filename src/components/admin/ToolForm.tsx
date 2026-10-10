"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** Shared look for admin tool fields. */
export const field = "h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent-line";
export const area = "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent-line";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

/** A form for one admin action: the fields, a button, and what happened. Clears itself after it works. */
export function ToolForm({ action, submit, pending: pendingLabel = "Saving…", children, className }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; submit: string; pending?: string; children: React.ReactNode; className?: string }) {
  const [state, run, pending] = useActionState<ActionState, FormData>(action, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={run} className={cn("space-y-4", className)}>
      {children}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submit}
        </Button>
        <AnimatePresence mode="wait">
          {(state.message || state.error) && !pending && (
            <motion.p key={state.message ?? state.error} role="status" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("text-sm", state.error ? "text-danger" : "text-success")}>
              {state.error ?? state.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
