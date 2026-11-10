"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CoverFee, useCardFee } from "@/components/checkout/CoverFee";
import { DrawnCheck } from "@/components/pos/bits";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { CommissionStatus as Status } from "@/lib/commissions/server";
import { money } from "@/lib/format";
import { cardFeeFor } from "@/lib/pos/card-fee";

type View = { status: Status; name: string; idea: string; shade: string; shadeHex: string | null; neededBy: string; photos: number; quoteCents: number | null; quoteNote: string };

const STEPS: { at: Status[]; label: string }[] = [
  { at: ["NEW"], label: "Sent" },
  { at: ["QUOTED"], label: "Quoted" },
  { at: ["ACCEPTED"], label: "Accepted" },
  { at: ["PAID"], label: "Paid" },
];

/** The customer's page for a lamp request: waiting, the quote (yes or no), paying, and paid. */
export function CommissionStatus({ token, sent, c, etransfer, card, order }: { token: string; sent: boolean; c: View; etransfer: { code: string; sendTo: string; amountCents: number } | null; card: boolean; order: { viewToken: string; orderNumber: string } | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = c.name.split(/\s+/)[0];
  const step = STEPS.findIndex((s) => s.at.includes(c.status));

  // Accepted: watch for the payment landing (e-Transfer matched, or the card link paid).
  useEffect(() => {
    if (c.status !== "ACCEPTED") return;
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await fetch(`/api/lightlab/commission/${token}`, { cache: "no-store" }).catch(() => null);
      const d = r?.ok ? await r.json() : null;
      if (d?.status && d.status !== "ACCEPTED") router.refresh();
    }, 6000);
    return () => clearInterval(t);
  }, [c.status, token, router]);

  async function answer(accept: boolean) {
    if (!accept && !confirm("Pass on this quote? You can always reply to the email if you'd like to change something instead.")) return;
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/lightlab/commission/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accept }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setError(d.error ?? "Couldn't save that. Please try again.");
    router.refresh();
  }

  return (
    <div>
      <p className="ll-accent mt-8 text-3xl">{c.status === "PAID" ? "it's happening" : sent ? "sent!" : "your lamp request"}</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {c.status === "NEW" ? (sent ? `Thanks, ${first}! We got your idea.` : "We're working on your quote") : c.status === "QUOTED" ? "Your quote is ready" : c.status === "ACCEPTED" ? "Last step: payment" : c.status === "PAID" ? "Paid. We're making your lamp." : c.status === "DECLINED" ? "You passed on this quote" : "This request is closed"}
      </h1>

      {step >= 0 && (
        <ol className="mt-6 flex items-center gap-2 text-xs" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.label} className="flex flex-1 items-center gap-2">
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border font-semibold", i <= step ? "border-transparent bg-accent text-accent-ink" : "border-line text-faint")}>{i + 1}</span>
              <span className={i <= step ? "font-medium" : "text-faint"}>{s.label}</span>
              {i < STEPS.length - 1 && <span className={cn("h-px flex-1", i < step ? "bg-accent" : "bg-line")} />}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-8 space-y-6">
        {c.status === "NEW" && <p className="text-lg leading-relaxed text-muted">We&apos;ll look over your idea and email you a price, usually within a couple of days. This page updates too, so you can bookmark it.</p>}

        {c.status === "QUOTED" && c.quoteCents != null && (
          <section className="rounded-3xl border border-line bg-surface p-6">
            <p className="font-display text-5xl font-bold tabular-nums">{money(c.quoteCents)}</p>
            {c.quoteNote && <p className="mt-4 whitespace-pre-line leading-relaxed">{c.quoteNote}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" disabled={busy} onClick={() => answer(true)}>
                Yes, make it
              </Button>
              <Button size="lg" variant="secondary" disabled={busy} onClick={() => answer(false)}>
                No thanks
              </Button>
            </div>
            <p className="mt-3 text-xs text-faint">Want something changed first? Reply to the quote email.</p>
          </section>
        )}

        {c.status === "ACCEPTED" && c.quoteCents != null && <Pay token={token} quoteCents={c.quoteCents} etransfer={etransfer} card={card} />}

        {c.status === "PAID" && (
          <section className="rounded-3xl border border-line bg-surface p-6 text-center">
            <DrawnCheck className="mx-auto h-20 w-20 text-success" />
            <p className="mt-3 text-lg">Thank you, {first}! Your receipt is in your email.</p>
            {order && (
              <Link href={`/orders/${order.viewToken}`} className="mt-4 inline-block text-accent-text underline underline-offset-4">
                Follow order {order.orderNumber}
              </Link>
            )}
          </section>
        )}

        {(c.status === "DECLINED" || c.status === "CLOSED") && <p className="text-lg text-muted">Changed your mind, or want to try a different idea? Just reply to our email, or <Link href="/lightlab/commission" className="text-accent-text underline underline-offset-4">send a new one</Link>.</p>}

        <AnimatePresence>
          {error && (
            <motion.p role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <details className="rounded-3xl border border-line p-5">
          <summary className="cursor-pointer font-medium">Your idea</summary>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">{c.idea}</p>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            {c.shadeHex && <span className="h-4 w-4 rounded-full border border-line-strong" style={{ background: c.shadeHex }} />}
            Shade: {c.shade || "help me choose"}
            {c.neededBy && <span>· Hoping for it by {c.neededBy}</span>}
            {c.photos > 0 && <span>· {c.photos} photo{c.photos === 1 ? "" : "s"} sent</span>}
          </p>
        </details>
      </div>
    </div>
  );
}

/** e-Transfer (the code, matched automatically) or card (a Square link, after the fee question). */
function Pay({ token, quoteCents, etransfer, card }: { token: string; quoteCents: number; etransfer: { code: string; sendTo: string; amountCents: number } | null; card: boolean }) {
  const [by, setBy] = useState<"etransfer" | "card">(etransfer ? "etransfer" : "card");
  const fee = useCardFee();
  const [coverFee, setCoverFee] = useState<boolean | null>(null);
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const asks = !!fee?.on;
  const feeCents = asks ? cardFeeFor(quoteCents, fee!) : 0;
  const total = quoteCents + (coverFee ? feeCents : 0);

  async function payByCard() {
    if (asks && coverFee == null) return setAsked(true);
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/lightlab/commission/${token}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coverFee: !!coverFee }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok || !d.url) {
      setBusy(false);
      return setError(d.error ?? "Couldn't set up the card payment. Please try again.");
    }
    window.location.href = d.url;
  }

  if (!etransfer && !card) return <p className="text-muted">We&apos;ll be in touch about payment shortly.</p>;
  return (
    <section className="rounded-3xl border border-line bg-surface p-6">
      {etransfer && card && (
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-full border border-line p-1" role="tablist">
          {(["etransfer", "card"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={by === k} onClick={() => setBy(k)} className={cn("relative rounded-full py-2 text-sm font-semibold", by === k ? "text-accent-ink" : "text-muted")}>
              {by === k && <motion.span layoutId="cm-pay-by" className="absolute inset-0 rounded-full bg-accent" />}
              <span className="relative">{k === "etransfer" ? "e-Transfer" : "Card"}</span>
            </button>
          ))}
        </div>
      )}
      {by === "etransfer" && etransfer ? (
        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-muted">Send</dt>
            <dd className="font-display text-3xl font-bold tabular-nums">{money(etransfer.amountCents)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">To</dt>
            <dd className="select-all font-mono">{etransfer.sendTo}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Put this in the message</dt>
            <dd className="select-all font-mono text-2xl font-bold tracking-wider">{etransfer.code}</dd>
          </div>
          <p className="pt-2 text-sm text-muted">It&apos;s confirmed automatically when it lands, and this page will update. We emailed you these details too.</p>
        </dl>
      ) : (
        <div>
          {asks && <CoverFee fee={fee!} feeCents={feeCents} value={coverFee} onChange={setCoverFee} error={asked} className="mb-5" />}
          <Button size="lg" className="w-full" disabled={busy} onClick={payByCard}>
            {busy ? "Opening Square…" : `Pay ${money(total)} by card`}
          </Button>
          <p className="mt-2 text-center text-xs text-faint">You&apos;ll pay on Square&apos;s secure page (card, Apple Pay or Google Pay), then come back here.</p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
