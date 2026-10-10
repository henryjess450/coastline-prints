"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { NextStepButton } from "@/components/admin/NextStepButton";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { cn } from "@/lib/cn";
import type { NextStep } from "@/lib/orders/next-step";

export type AdminCard = {
  id: string;
  orderNumber: string;
  status: string;
  fulfillment: string;
  customer: string;
  firstName: string;
  returning: boolean;
  /** "dragon.stl × 2 · PLA Green" (the first item) */
  summary: string;
  /** How many other items there are. */
  more: number;
  pieces: number;
  printers: string;
  printTime: string;
  /** "Wednesday, October 14, 5 to 6 pm" or "Ship to Halifax, NS" */
  when: string;
  due: "late" | "today" | "tomorrow" | "later" | null;
  total: string;
  next: NextStep | null;
};

const dueTag = { late: "Overdue", today: "Today", tomorrow: "Tomorrow", later: null } as const;

/**
 * An order as a card floating on the water: who it's for, what it is, when
 * it's due, and one big button for the next step. Cards glide between board
 * columns (and lists) as they move along.
 */
export function OrderCard({ card, showStatus = false, showPrint = false }: { card: AdminCard; showStatus?: boolean; showPrint?: boolean }) {
  const tag = card.due ? dueTag[card.due] : null;
  return (
    <motion.article
      layout
      layoutId={`card-${card.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={cn("rounded-2xl border bg-bg/75 p-4 shadow-[var(--shadow)]", card.due === "late" ? "border-danger/60" : card.due === "today" ? "border-sand/70" : "border-[var(--sea-wake)]/20")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/orders/${card.id}`} className="whitespace-nowrap font-mono text-sm font-semibold text-accent-text underline-offset-4 hover:underline">
            {card.orderNumber}
          </Link>
          <p className="truncate font-display text-lg font-bold leading-tight">
            {card.customer}
            {card.returning && (
              <span className="ml-2 align-middle text-xs font-semibold text-sand" title="Has ordered before">
                ★
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {showStatus && <StatusBadge status={card.status} fulfillment={card.fulfillment} />}
          {tag && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", card.due === "late" ? "bg-danger/15 text-danger" : "bg-sand/20 text-sand")}>{tag}</span>}
        </div>
      </div>

      <p className="mt-2 truncate text-sm">
        {card.summary}
        {card.more > 0 && <span className="text-muted"> +{card.more} more</span>}
      </p>
      <p className="mt-0.5 text-xs text-muted">{card.when}</p>
      {showPrint && (
        <p className="mt-0.5 text-xs text-faint">
          {card.printers} · about {card.printTime} · {card.pieces} piece{card.pieces === 1 ? "" : "s"}
        </p>
      )}

      {card.next && <NextStepButton key={`${card.id}:${card.status}`} orderId={card.id} from={card.status} step={card.next} customer={card.firstName} className="mt-3" />}
    </motion.article>
  );
}
