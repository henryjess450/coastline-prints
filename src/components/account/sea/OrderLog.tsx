"use client";
import { motion } from "framer-motion";
import Link from "next/link";

export type LoggedOrder = {
  orderNumber: string;
  viewToken: string;
  /** "Oct 7, 2026" */
  date: string;
  total: string;
  /** "Printing", "Picked up", "Delivered" … */
  statusLabel: string;
  done: boolean;
  /** "dragon.stl × 2, base.stl" */
  summary: string;
  /** False once the files have been removed (90 days after pickup). */
  canReorder: boolean;
};

/**
 * Every order as a stop on one line down the page, newest first, like a
 * ship's log: date on the left, what it was and where it's at on the right.
 */
export function OrderLog({ orders }: { orders: LoggedOrder[] }) {
  return (
    <ol className="relative">
      <span aria-hidden className="absolute bottom-3 left-[7px] top-3 w-0.5 rounded-full bg-[var(--sea-wake)]/25 sm:left-[127px]" />
      {orders.map((o, i) => (
        <motion.li
          key={o.orderNumber}
          className="relative grid gap-1 pb-9 pl-8 last:pb-0 sm:grid-cols-[112px_1fr] sm:gap-6 sm:pl-0"
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ delay: Math.min(i, 6) * 0.06, type: "spring", stiffness: 260, damping: 26 }}
        >
          <motion.span
            aria-hidden
            className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 sm:left-[120px] ${o.done ? "border-accent-text bg-accent-text" : "border-accent-text bg-[var(--sea-2)]"}`}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + Math.min(i, 6) * 0.06, type: "spring", stiffness: 500, damping: 16 }}
          />
          <p className="text-sm text-faint sm:pt-0.5 sm:text-right">{o.date}</p>
          <div className="sm:pl-10">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link href={`/orders/${o.viewToken}`} className="font-mono font-semibold underline-offset-4 hover:text-accent-text hover:underline">
                {o.orderNumber}
              </Link>
              <span className="font-mono text-sm text-muted">{o.total}</span>
              <span className={`text-sm ${o.done ? "text-faint" : "font-semibold text-accent-text"}`}>{o.statusLabel}</span>
            </div>
            <p className="mt-1 truncate text-sm text-muted">{o.summary}</p>
            {o.canReorder && (
              <Link href={`/order?reorder=${o.viewToken}`} className="group mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-500 group-hover:-rotate-180" aria-hidden>
                  <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />
                </svg>
                <span className="underline-offset-4 group-hover:underline">Print it again</span>
              </Link>
            )}
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
