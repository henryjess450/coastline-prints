"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";

export type EtransferDetails = { attemptId: string; code: string; amountCents: number; sendTo: string; expiresAt: string | null };

/**
 * "Send your e-Transfer" with copy buttons, then waits for the deposit: polls
 * the server (which checks the inbox) until the order is paid or time runs out.
 */
export function EtransferWaiting({ details, onPaid, onExpired }: { details: EtransferDetails; onPaid: (viewToken: string) => void; onExpired?: () => void }) {
  const [state, setState] = useState<"waiting" | "paid" | "expired">("waiting");
  const paidRef = useRef(onPaid);
  const expiredRef = useRef(onExpired);
  useEffect(() => {
    paidRef.current = onPaid;
    expiredRef.current = onExpired;
  });

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const res = await fetch(`/api/checkout/${details.attemptId}`, { cache: "no-store" }).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (stop) return;
      if (data?.status === "paid") {
        setState("paid");
        paidRef.current(data.viewToken);
        return;
      }
      if (data?.status === "expired" || data?.status === "failed") {
        setState("expired");
        expiredRef.current?.();
        return;
      }
      timer = setTimeout(poll, document.hidden ? 15_000 : 5_000);
    };
    timer = setTimeout(poll, 3_000);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [details.attemptId]);

  const left = useCountdown(details.expiresAt);

  return (
    <Card flat highlight className="mx-auto max-w-2xl p-6 sm:p-10">
      <AnimatePresence mode="wait" initial={false}>
        {state === "expired" ? (
          <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <h2 className="font-display text-2xl font-bold">Time ran out</h2>
            <p className="mt-3 text-muted">
              We didn&apos;t see an e-Transfer for {details.code} in time, so the order was cancelled. If you already sent it, reply to the email we sent you and we&apos;ll sort it out.
            </p>
          </motion.div>
        ) : (
          <motion.div key="waiting" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">Last step</p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">Send your Interac e-Transfer</h2>
            <p className="mt-2 text-muted">Open your banking app and send exactly this. Your order is confirmed as soon as it lands, usually within a minute or two.</p>

            <dl className="mt-6 space-y-3">
              <CopyRow label="Send to" value={details.sendTo} />
              <CopyRow label="Amount" value={money(details.amountCents)} copyValue={(details.amountCents / 100).toFixed(2)} />
              <CopyRow label="Message (important)" value={details.code} mono highlight />
            </dl>
            <p className="mt-3 text-sm text-muted">
              Put <strong className="font-mono text-fg">{details.code}</strong> in the message so we know it&apos;s yours. No security question needed: it deposits automatically.
            </p>

            <div className="mt-8 flex items-center gap-4 rounded-2xl border border-line px-5 py-4" aria-live="polite">
              <Pulse />
              <div className="min-w-0">
                <p className="font-semibold">{state === "paid" ? "Payment received!" : "Waiting for your deposit…"}</p>
                <p className="text-sm text-muted">{state === "paid" ? "Confirming your order." : left ? `Keep this page open, or come back from the email we sent you. ${left} left to send it.` : "Checking…"}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function CopyRow({ label, value, copyValue, mono, highlight }: { label: string; value: string; copyValue?: string; mono?: boolean; highlight?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-2xl px-4 py-3", highlight ? "bg-accent-soft" : "bg-surface-strong")}>
      <div className="min-w-0">
        <dt className="text-xs text-faint">{label}</dt>
        <dd className={cn("break-all text-lg font-semibold", mono && "font-mono tracking-wider")}>{value}</dd>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(copyValue ?? value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }}
        className="relative shrink-0 rounded-full border border-line px-3.5 py-1.5 text-sm font-medium transition-[border-color,transform] hover:border-accent-line active:scale-95"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={copied ? "y" : "n"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="block">
            {copied ? "Copied" : "Copy"}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}

function Pulse() {
  const reduce = useReducedMotion();
  return (
    <span className="relative grid h-10 w-10 shrink-0 place-items-center" aria-hidden>
      {!reduce && <motion.span className="absolute inset-0 rounded-full bg-accent-line" animate={{ scale: [0.6, 0.85, 1.4], opacity: [0, 0.45, 0] }} transition={{ duration: 2, times: [0, 0.25, 1], ease: "easeOut", repeat: Infinity }} />}
      <span className="relative h-4 w-4 rounded-full bg-accent-line" />
    </span>
  );
}

/** "1 h 42 min" (or "2 h") until the deadline, updated every 30 seconds. */
function useCountdown(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return null;
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60_000));
  if (mins < 60) return `${mins} min`;
  return mins % 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins / 60} h`;
}
