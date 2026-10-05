"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useActionState, useState } from "react";
import { updateStatusAction, type ActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { ORDER_STATUSES } from "@/lib/orders/status";
import { cn } from "@/lib/cn";

/** Pipeline stepper: click a step, optionally add a note and email the customer. */
export function StatusControl({ orderId, current }: { orderId: string; current: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateStatusAction, {});
  const currentIdx = ORDER_STATUSES.findIndex((s) => s.id === current);
  const [target, setTarget] = useState<string>(ORDER_STATUSES[Math.min(currentIdx + 1, ORDER_STATUSES.length - 1)].id);
  const ready = target === "READY_FOR_PICKUP";
  const same = target === current;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="status" value={target} />
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Order status">
        {ORDER_STATUSES.map((s, i) => {
          const done = i < currentIdx;
          const isCurrent = i === currentIdx;
          const chosen = s.id === target && !isCurrent;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setTarget(s.id)}
                aria-pressed={chosen}
                className={cn(
                  "flex w-full items-center gap-2 rounded-full border px-3 py-2 text-left text-sm transition-colors",
                  isCurrent && "border-accent-line bg-accent font-semibold text-accent-ink",
                  chosen && "border-accent-line bg-accent-soft text-fg",
                  !isCurrent && !chosen && (done ? "border-line text-muted" : "border-line text-faint hover:text-fg"),
                )}
              >
                <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold", isCurrent ? "bg-white/20" : done ? "bg-success/20 text-success" : "bg-surface-strong")}>
                  {done ? "✓" : i + 1}
                </span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      {!same && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm">
            Move to <strong>{ORDER_STATUSES.find((s) => s.id === target)?.label}</strong>
          </p>
          <textarea name="note" rows={2} maxLength={1000} placeholder="Optional note for the customer (included in the email)" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent-line" />
          {ready ? (
            <p className="text-sm text-muted">The customer will be emailed that it&apos;s ready, with their pickup time and the pickup address.</p>
          ) : (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="notify" className="h-4 w-4 accent-[var(--accent)]" /> Email the customer about this update
            </label>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : ready ? "Mark ready and email customer" : "Update status"}
          </Button>
        </motion.div>
      )}

      <AnimatePresence>
        {(state.message || state.error) && !pending && (
          <motion.p key={state.message ?? state.error} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" className={cn("text-sm", state.error ? "text-danger" : "text-success")}>
            {state.error ?? state.message}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}
