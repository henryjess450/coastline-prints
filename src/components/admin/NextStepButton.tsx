"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useActionState, useEffect, useRef, useState } from "react";
import { nextStepAction, type ActionState } from "@/app/admin/actions";
import { bounce } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { NextStep } from "@/lib/orders/next-step";

/**
 * One big button for whatever comes next with an order. Steps that email the
 * customer (ready, shipped) ask for a second tap, and tracked parcels can take
 * a tracking number first. A tick and the new step show once it's saved.
 */
export function NextStepButton({ orderId, from, step, customer, size = "md", className }: { orderId: string; from: string; step: NextStep; customer: string; size?: "md" | "lg"; className?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(nextStepAction, {});
  const [armed, setArmed] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const done = state.ok && !pending;
  useEffect(() => {
    if (done) bounce(btn.current);
  }, [done]);
  // A second tap is needed for emails; forget it if they wander off.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(t);
  }, [armed]);

  const confirm = step.emails && !armed;
  const label = pending ? "Saving…" : armed ? (step.tracking ? "Ship it and email" : `Email ${customer}`) : step.label;

  return (
    <form
      action={action}
      className={cn("space-y-2", className)}
      onSubmit={(e) => {
        if (confirm) {
          e.preventDefault();
          setArmed(true);
        }
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={step.to} />
      <AnimatePresence initial={false}>
        {armed && step.tracking && (
          <motion.label initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="block overflow-hidden">
            <span className="mb-1 block text-xs text-muted">Tracking number (optional)</span>
            <input name="trackingNumber" autoComplete="off" autoFocus placeholder="From the box label" className="h-11 w-full rounded-xl border border-line bg-bg px-3 font-mono text-sm outline-none focus:border-accent-line" />
          </motion.label>
        )}
      </AnimatePresence>
      {done ? (
        <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn("flex items-center justify-center gap-2 rounded-full bg-success/15 font-semibold text-success", size === "lg" ? "h-14 text-base" : "h-11 text-sm")} role="status">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12l5 5 9-10" />
          </svg>
          {step.done}
        </motion.p>
      ) : (
        <motion.button
          ref={btn}
          type="submit"
          disabled={pending}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-60",
            size === "lg" ? "h-14 text-base" : "h-11 text-sm",
            armed ? "bg-sand text-[#0b1622]" : "bg-accent text-accent-ink hover:brightness-110",
          )}
        >
          {label}
          {!pending && !armed && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 5l7 7-7 7" />
            </svg>
          )}
        </motion.button>
      )}
      {armed && !pending && (
        <button type="button" onClick={() => setArmed(false)} className="block w-full text-center text-xs text-muted hover:text-fg">
          Not yet
        </button>
      )}
      {state.error && !pending && (
        <p role="alert" className="text-center text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
