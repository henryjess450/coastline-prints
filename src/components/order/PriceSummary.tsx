"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useConfig } from "@/components/ConfigProvider";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { hours, money } from "@/lib/format";
import type { CartItem } from "@/lib/order/store";
import type { CartQuote } from "@/lib/order/use-quote";

const formatTotal = (v: number) => money(Math.round(v));

export function PriceSummary({ items, cartQuote, onCheckout }: { items: CartItem[]; cartQuote: CartQuote; onCheckout?: () => void }) {
  const cfg = useConfig();
  const { quote, confirmed, server, ready } = cartQuote;
  const [open, setOpen] = useState<string | null>(null);

  const blocked = !quote || !quote.ok;
  const status = !ready
    ? "Waiting for uploads to finish…"
    : server.status === "error"
      ? server.message
      : quote && !quote.ok
        ? "Fix the items marked “Can't print” to continue"
        : confirmed
        ? "Price checked on our server"
        : "Checking price…";

  return (
    <Card highlight className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Your price</h2>
        <span className={cn("flex items-center gap-1.5 text-right text-xs", server.status === "error" || blocked ? "text-danger" : "text-faint")} aria-live="polite">
          <span className={cn("h-2 w-2 shrink-0 rounded-sm", server.status === "error" || blocked ? "bg-danger" : confirmed ? "bg-success" : "animate-pulse bg-sand")} />
          {status}
        </span>
      </div>

      <ul className="mt-4 space-y-1 text-sm">
        {items.map((item, idx) => {
          const q = quote?.items[idx];
          const expanded = open === item.key;
          return (
            <li key={item.key} className="rounded-lg">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : item.key)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-surface-strong"
              >
                <span className="min-w-0 truncate">
                  <motion.span animate={{ rotate: expanded ? 90 : 0 }} className="mr-1.5 inline-block text-faint">
                    ›
                  </motion.span>
                  {item.fileName} <span className="text-faint">× {item.quantity}</span>
                </span>
                <span className="shrink-0 font-mono tabular-nums">{q ? (q.ok ? money(q.lineCents) : <span className="text-danger">Can&apos;t print</span>) : "…"}</span>
              </button>
              <AnimatePresence initial={false}>
                {expanded && q?.ok && (
                  <motion.dl
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden px-2 pl-6 text-xs text-muted"
                  >
                    <Row label={`Filament: ${(q.gramsEach * item.quantity).toFixed(1)} g`} value={money(q.filamentCents)} />
                    <Row label={`Machine time: ${hours(q.hoursTotal)} at ${money(cfg.pricing.pricePerHourCents)}/h`} value={money(q.machineCents)} />
                    <Row label={`Per-piece fee: ${item.quantity} × ${money(cfg.pricing.markupPerPieceCents)}`} value={money(q.markupCents)} />
                  </motion.dl>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>

      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
        <Row label="Order fee" value={quote ? money(quote.baseFeeCents) : "…"} />
        {quote && quote.minimumAdjCents > 0 && <Row label={`Minimum order top-up (${money(cfg.pricing.minimumOrderCents)})`} value={money(quote.minimumAdjCents)} />}
        <Row label="Pickup" value="Free" />
      </dl>

      <div className="mt-3 flex items-end justify-between border-t-2 border-line-strong pt-3">
        <span className="text-sm text-muted">Total (CAD)</span>
        {quote ? <AnimatedNumber value={quote.ok ? quote.totalCents : 0} format={formatTotal} className="font-display text-3xl font-bold tabular-nums" /> : <span className="skeleton h-9 w-28" />}
      </div>
      <p className="mt-1 text-xs text-faint">Print time and filament are estimates. The price you see here is the price you pay.</p>

      <Button className="mt-4 w-full" size="lg" disabled={blocked || !confirmed || !onCheckout} onClick={onCheckout}>
        Continue to checkout
      </Button>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <dt>{label}</dt>
      <dd className="shrink-0 font-mono tabular-nums">{value}</dd>
    </div>
  );
}
