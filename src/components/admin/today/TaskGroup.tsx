"use client";
import { AnimatePresence, motion } from "framer-motion";
import { OrderCard, type AdminCard } from "@/components/admin/OrderCard";

/** One kind of job ("To clean up"), with its count and the orders waiting on it. */
export function TaskGroup({ title, hint, cards, showPrint }: { title?: string; hint?: string; cards: AdminCard[]; showPrint?: boolean }) {
  if (!cards.length) return null;
  return (
    <motion.div layout className="mt-10 first:mt-0">
      {title && (
        <h3 className="flex items-baseline gap-3 font-display text-xl font-bold">
          {title}
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-accent px-2 text-sm text-accent-ink tabular-nums">{cards.length}</span>
        </h3>
      )}
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {cards.map((c) => (
            <OrderCard key={c.id} card={c} showPrint={showPrint} />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
