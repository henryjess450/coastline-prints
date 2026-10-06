"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ORDER_STATUSES, statusIndex, statusInfo } from "@/lib/orders/status";

type Row = { orderNumber: string; viewToken: string; status: string; total: string; date: string };

/** Orders slide in one by one; each has a little track that fills up to its status, with the current step pulsing. */
export function OrdersList({ orders }: { orders: Row[] }) {
  return (
    <ul className="space-y-3">
      {orders.map((o, i) => {
        const at = statusIndex(o.status);
        const done = o.status === "PICKED_UP";
        return (
          <motion.li key={o.orderNumber} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + Math.min(i, 8) * 0.08, type: "spring", stiffness: 260, damping: 24 }}>
            <Link href={`/orders/${o.viewToken}`} className="group block">
              <motion.div className="rounded-2xl border border-line bg-surface p-4 transition-colors group-hover:border-accent-line sm:p-5" whileHover={{ x: 6 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono font-semibold">{o.orderNumber}</span>
                  <span className="text-sm text-faint">
                    {o.date} · <span className="font-mono text-fg">{o.total}</span>
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5" aria-label={`Status: ${statusInfo(o.status).label}`}>
                  {ORDER_STATUSES.map((s, k) => (
                    <span key={s.id} className="flex flex-1 items-center gap-1.5">
                      <motion.span
                        className={`relative h-3 w-3 shrink-0 rounded-full ${k <= at ? (done ? "bg-success" : "bg-accent-line") : "bg-surface-strong"}`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4 + i * 0.08 + k * 0.07, type: "spring", stiffness: 500, damping: 15 }}
                      >
                        {k === at && !done && <motion.span className="absolute inset-0 rounded-full bg-accent-line" animate={{ scale: [1, 2.2], opacity: [0.6, 0] }} transition={{ duration: 1.4, repeat: Infinity }} />}
                      </motion.span>
                      {k < ORDER_STATUSES.length - 1 && (
                        <span className="h-0.5 flex-1 overflow-hidden rounded-full bg-surface-strong">
                          <motion.span className={`block h-full ${done ? "bg-success" : "bg-accent-line"}`} initial={{ width: 0 }} animate={{ width: k < at ? "100%" : "0%" }} transition={{ delay: 0.45 + i * 0.08 + k * 0.07, duration: 0.3 }} />
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-sm text-muted">
                  {statusInfo(o.status).label}
                  <span className="ml-2 inline-block text-accent-text opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-1 group-hover:opacity-100">View →</span>
                </p>
              </motion.div>
            </Link>
          </motion.li>
        );
      })}
    </ul>
  );
}
