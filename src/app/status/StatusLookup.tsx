"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ORDER_STATUSES, statusIndex, statusInfo } from "@/lib/orders/status";
import { cn } from "@/lib/cn";
import { lookupOrderAction, type LookupState } from "./actions";

const input = "h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]";

export function StatusLookup({ prefill }: { prefill: string }) {
  const [state, action, pending] = useActionState<LookupState, FormData>(lookupOrderAction, {});
  return (
    <>
      <Card flat className="mt-8 p-6 sm:p-8">
        <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Order number</span>
            <input name="orderNumber" defaultValue={prefill} placeholder="CP-2610-AB2C" autoCapitalize="characters" required className={cn(input, "font-mono uppercase")} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Email</span>
            <input name="email" type="email" autoComplete="email" required className={input} />
          </label>
          <Button type="submit" disabled={pending} className="h-11">
            {pending ? "Looking…" : "Check status"}
          </Button>
        </form>
        {state.error && !pending && (
          <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: [0, -6, 6, 0] }} role="alert" className="mt-3 text-sm text-danger">
            {state.error}
          </motion.p>
        )}
      </Card>

      <AnimatePresence mode="wait">{state.order && <Tracker key={state.order.orderNumber + state.order.status} order={state.order} />}</AnimatePresence>
    </>
  );
}

function Tracker({ order }: { order: NonNullable<LookupState["order"]> }) {
  const reduce = useReducedMotion();
  const current = statusIndex(order.status);
  const at = (id: string) => order.history.findLast((h) => h.status === id)?.at;
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-8 space-y-6">
      <Card flat highlight className="p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-xl font-bold">{order.orderNumber}</h2>
          <span className="text-sm text-muted">Placed {fmt(order.placedAt)}</span>
        </div>
        <p className="mt-1 text-lg font-semibold">{statusInfo(order.status).label}</p>
        <p className="text-muted">{statusInfo(order.status).customer}</p>

        <ol className="relative mt-8 space-y-0" aria-label="Order progress">
          {ORDER_STATUSES.map((s, i) => {
            const done = i < current;
            const isCurrent = i === current;
            const time = at(s.id);
            return (
              <li key={s.id} className="relative flex gap-4 pb-6 last:pb-0" aria-current={isCurrent ? "step" : undefined}>
                {i < ORDER_STATUSES.length - 1 && (
                  <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 overflow-hidden rounded bg-line" aria-hidden>
                    <motion.span
                      className="absolute inset-x-0 top-0 bg-accent-line"
                      initial={{ height: reduce ? (done ? "100%" : "0%") : "0%" }}
                      animate={{ height: done ? "100%" : "0%" }}
                      transition={{ delay: reduce ? 0 : 0.25 + i * 0.18, duration: 0.35 }}
                    />
                  </span>
                )}
                <motion.span
                  initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: reduce ? 0 : 0.1 + i * 0.18, type: "spring", stiffness: 400, damping: 22 }}
                  className={cn(
                    "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                    done && "bg-accent text-accent-ink",
                    isCurrent && "bg-accent text-accent-ink",
                    !done && !isCurrent && "border-2 border-line text-faint",
                  )}
                >
                  {isCurrent && !reduce && <motion.span className="absolute inset-0 rounded-full border-2 border-accent-line" animate={{ scale: [1, 1.5], opacity: [0.8, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />}
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <motion.path d="M5 13l4 4L19 7" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: reduce ? 0 : 0.25 + i * 0.18, duration: 0.3 }} />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </motion.span>
                <div className="pt-1">
                  <p className={cn("font-medium", !done && !isCurrent && "text-faint")}>{s.label}</p>
                  {time && (done || isCurrent) && <p className="text-xs text-faint">{fmt(time)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card flat className="p-6">
          <h3 className="font-display font-semibold">Pickup</h3>
          <p className="mt-1">{order.pickupWhen ?? "Not booked yet"}</p>
          <p className="mt-1 text-xs text-faint">The address is in your receipt email. Need a different time? Reply to that email.</p>
        </Card>
        <Card flat className="p-6">
          <h3 className="font-display font-semibold">Items</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {order.items.map((it, i) => (
              <li key={i}>
                {it.fileName} × {it.quantity} <span className="text-muted">· {it.material} {it.colorName}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </motion.div>
  );
}
