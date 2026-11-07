"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useTransition } from "react";
import { createCardsAction, retireCardsAction } from "@/app/lightlab/admin/cards/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { CardBatch } from "@/lib/codes/thank-you";

type Batch = CardBatch & { count: number; used: number };

const input = "h-11 w-full rounded-xl border border-line bg-elev px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]";
const COUNTS = [12, 24, 48, 96];
const EXPIRY: { label: string; days: number | null }[] = [
  { label: "Never", days: null },
  { label: "3 months", days: 91 },
  { label: "6 months", days: 182 },
  { label: "1 year", days: 365 },
];
const pdfUrl = (id: string) => `/lightlab/admin/cards/${id}/pdf`;

/** Make a batch of printed thank-you cards (one-use coupons with QR codes) and see how many came back. */
export function CardMaker({ batches, defaults }: { batches: Batch[]; defaults: { heading: string; message: string; percent: number } }) {
  const [count, setCount] = useState(12);
  const [percent, setPercent] = useState(String(defaults.percent));
  const [days, setDays] = useState<number | null>(182);
  const [heading, setHeading] = useState(defaults.heading);
  const [message, setMessage] = useState(defaults.message);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // For the preview's expiry date.
  const [now] = useState(() => Date.now());
  const pct = Math.max(1, Math.min(50, Math.round(Number(percent) || 0)));

  function make() {
    setError(null);
    setNote(null);
    // Open the tab now (browsers block it after a wait), then point it at the PDF.
    const tab = window.open("about:blank", "_blank");
    start(async () => {
      const r = await createCardsAction({ count, percent: pct, days, heading, message });
      if (r.error || !r.id) {
        tab?.close();
        setError(r.error ?? "Couldn't make the cards.");
        return;
      }
      if (tab) tab.location.href = pdfUrl(r.id);
      setNote(`${count} cards made. The PDF opened in a new tab.`);
    });
  }

  function retire(b: Batch) {
    if (!confirm(`Turn off the ${b.count - b.used} unused cards from ${new Date(b.createdAt).toLocaleDateString("en-CA")}? They won't work any more.`)) return;
    start(async () => {
      const r = await retireCardsAction(b.id);
      setNote(r.message ?? r.error ?? null);
    });
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <h1 className="font-display text-2xl font-bold tracking-tight">Thank-you cards</h1>
          <p className="mt-1 text-sm text-muted">Each card gets its own one-use coupon with a QR code. It works online (the QR opens the shop and adds the discount at checkout) and at the market stand register (type the number or scan the QR). Twelve to a letter page, with cut lines.</p>

          <div className="mt-6 space-y-5">
            <div>
              <span className="mb-2 block text-xs font-medium text-muted">How many</span>
              <div className="flex flex-wrap items-center gap-2">
                {COUNTS.map((c) => (
                  <button key={c} type="button" onClick={() => setCount(c)} aria-pressed={count === c} className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors active:scale-95", count === c ? "border-transparent bg-accent text-accent-ink" : "border-line text-muted hover:text-fg")}>
                    {c} <span className="opacity-60">· {c / 12} {c === 12 ? "page" : "pages"}</span>
                  </button>
                ))}
                <input type="number" min={1} max={600} value={count} onChange={(e) => setCount(Math.max(1, Math.min(600, Math.round(Number(e.target.value) || 1))))} className={cn(input, "w-24")} aria-label="Number of cards" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Percent off</span>
                <input type="number" min={1} max={50} value={percent} onChange={(e) => setPercent(e.target.value)} className={input} />
              </label>
              <div>
                <span className="mb-1 block text-xs font-medium text-muted">Expires</span>
                <div className="flex flex-wrap gap-1.5">
                  {EXPIRY.map((e) => (
                    <button key={e.label} type="button" onClick={() => setDays(e.days)} aria-pressed={days === e.days} className={cn("h-11 rounded-xl border px-3 text-sm transition-colors", days === e.days ? "border-accent-line bg-accent-soft text-fg" : "border-line text-muted hover:text-fg")}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Heading</span>
              <input value={heading} onChange={(e) => setHeading(e.target.value)} maxLength={60} className={input} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Small print under the offer</span>
              <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={90} className={input} />
            </label>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={make} disabled={pending || !heading.trim()}>
              {pending ? "Making…" : `Make ${count} cards and open the PDF`}
            </Button>
            {note && (
              <p className="text-sm text-success" role="status">
                {note}
              </p>
            )}
          </div>
        </section>

        {/* What one card looks like (the PDF uses the same layout). */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Preview</p>
          <div className="mx-auto aspect-square w-full max-w-[340px] rounded-2xl border border-dashed border-line-strong bg-white p-5 text-[#1a1a1a] shadow-sm">
            <div className="flex h-full flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lightlab-logo.png" alt="" className="h-8 w-auto" />
              <p className="mt-3 line-clamp-2 text-[15px] font-bold leading-tight">{heading || " "}</p>
              <p className="mt-1 text-[34px] font-bold leading-none text-[#297f9d]">{pct}% off</p>
              <p className="mt-1.5 line-clamp-2 text-[10px] text-[#666]">{message}</p>
              <div className="mt-auto flex w-full items-end gap-3 text-left">
                <span className="grid h-20 w-20 shrink-0 place-items-center rounded bg-[repeating-conic-gradient(#1a1a1a_0_25%,#fff_0_50%)] bg-[length:10px_10px] text-[0px]">QR</span>
                <div className="text-[9.5px] leading-snug">
                  <p>Scan to shop online,</p>
                  <p>or show this card at</p>
                  <p>our market stand.</p>
                  <p className="mt-1 font-mono text-[11px] font-bold">1234 5678 9012</p>
                  <p className="mt-0.5 text-[8px] text-[#666]">{days ? `One use. Expires ${new Date(now + days * 86_400_000).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}.` : "One use."}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold">Printed batches</h2>
        {batches.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None yet. Make your first batch above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {batches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {b.count} cards · {b.percent}% off
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(b.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })} · {b.expiresAt ? `expires ${new Date(b.expiresAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}` : "never expires"}
                  </p>
                </div>
                <div className="w-40">
                  <p className="text-xs text-muted">
                    {b.used} of {b.count} used
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elev">
                    <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${b.count ? (b.used / b.count) * 100 : 0}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
                  </div>
                </div>
                <a href={pdfUrl(b.id)} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:border-line-strong">
                  Print again
                </a>
                {b.used < b.count && (
                  <button type="button" onClick={() => retire(b)} disabled={pending} className="text-xs text-muted underline-offset-4 hover:text-danger hover:underline">
                    Turn off unused
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
