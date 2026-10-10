"use client";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { OrderCard, type AdminCard } from "@/components/admin/OrderCard";

export type BoardColumn = { id: string; title: string; cards: AdminCard[] };

/**
 * Orders as cards in columns, left to right as they move along. Tap a card's
 * button and it glides to the next column. On phones the columns swipe sideways.
 */
export function Board({ columns }: { columns: BoardColumn[] }) {
  return (
    <LayoutGroup>
      {/* Columns share the width when there's room (at least 232px each, so all five fit on a laptop), and swipe sideways when there isn't. */}
      <div className="-mx-4 grid snap-x snap-mandatory auto-cols-[82vw] grid-flow-col gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:auto-cols-[minmax(232px,1fr)] sm:px-6">
        {columns.map((col) => (
          <section key={col.id} aria-label={col.title} className="min-w-0 snap-start">
            <h2 className="mb-3 flex items-center justify-between gap-2 font-display text-lg font-bold">
              {col.title}
              <span className="grid h-7 min-w-7 place-items-center rounded-full bg-accent px-2 text-sm text-accent-ink tabular-nums">{col.cards.length}</span>
            </h2>
            <div className="min-h-24 space-y-3 rounded-3xl border border-dashed border-[var(--sea-wake)]/20 p-2">
              <AnimatePresence mode="popLayout">
                {col.cards.map((c) => (
                  <OrderCard key={c.id} card={c} showPrint={col.id === "todo" || col.id === "printing"} />
                ))}
              </AnimatePresence>
              {col.cards.length === 0 && <p className="py-6 text-center text-sm text-faint">Nothing here</p>}
            </div>
          </section>
        ))}
      </div>
    </LayoutGroup>
  );
}
