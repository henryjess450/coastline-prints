"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatedCount } from "@/components/motion/AnimatedCount";
import { bounce, Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type PrizeView = { id: string; points: number; title: string; blurb: string; kind: "coupon" | "order-fee" | "gift-card"; value: string };
export type PointsEntryView = { id: string; points: number; label: string; date: string };
type Won = { prize: string; kind: string; value: string; number: string; pin: string | null; balance: number };

/**
 * Points, straight on the water. The count rolls up; a line runs along every
 * prize, filled to where you are. Tap a prize to see it and trade your points
 * for it right here: it becomes a coupon in your wallet (or a gift card to
 * give away). Underneath, a short history of points earned and spent.
 */
export function PointsLine({ balance: start, pending, prizes, history }: { balance: number; pending: number; prizes: PrizeView[]; history: PointsEntryView[] }) {
  const router = useRouter();
  const [balance, setBalance] = useState(start);
  const next = prizes.find((p) => p.points > balance);
  const [openId, setOpenId] = useState<string | null>(next?.id ?? prizes[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [won, setWon] = useState<Won | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const top = prizes.at(-1)?.points ?? 1;
  const fill = Math.min(1, balance / top);
  const open = prizes.find((p) => p.id === openId) ?? null;

  async function trade(p: PrizeView) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/rewards/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prizeId: p.id }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return setError(data.error ?? "That didn't work. Please try again.");
    bounce(button.current);
    setWon(data.result);
    setBalance(data.result.balance);
    // The new coupon shows up in the wallet below, and the history picks up the trade.
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <p className="font-display text-7xl font-bold leading-none tabular-nums text-accent-text sm:text-8xl">
          <AnimatedCount value={balance} />
        </p>
        <p className="pb-2 text-xl text-muted">points</p>
        {pending > 0 && (
          <motion.p className="pb-2.5 text-sm font-semibold text-sand" animate={{ y: [0, -4, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
            +{pending} on the way, when your orders are picked up or delivered
          </motion.p>
        )}
      </div>

      {/* Every prize along one line, filled to where you are. Each one can be tapped. */}
      <div className="relative mt-10 h-1.5 rounded-full bg-[var(--sea-wake)]/20">
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-sand" initial={{ width: 0 }} animate={{ width: `${fill * 100}%` }} transition={{ delay: 0.3, duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
        {prizes.map((p, i) => {
          const reached = balance >= p.points;
          const active = p.id === openId;
          return (
            <div key={p.id} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${(p.points / top) * 100}%` }}>
              <motion.button
                type="button"
                onClick={() => {
                  setOpenId(p.id);
                  setError("");
                  setWon(null);
                }}
                aria-label={`${p.title}, ${p.points} points`}
                aria-pressed={active}
                className={cn("relative block h-5 w-5 rounded-full outline-offset-4", reached ? "bg-sand" : "bg-[var(--sea-3)] ring-2 ring-[var(--sea-wake)]/30")}
                initial={{ scale: 0 }}
                animate={{ scale: active ? 1.35 : 1 }}
                whileHover={{ scale: 1.45 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 500, damping: 18, delay: i * 0.03 }}
              >
                {active && <motion.span layoutId="prize-ring" className="absolute -inset-1.5 rounded-full border-2 border-accent-text" transition={{ type: "spring", stiffness: 420, damping: 30 }} />}
              </motion.button>
              {/* The last label lines up with the end of the line, so it never pokes past the page edge. */}
              <span className={`pointer-events-none absolute hidden w-24 text-[11px] leading-tight sm:block ${i === prizes.length - 1 ? "right-0 text-right" : "left-1/2 -translate-x-1/2 text-center"} ${i % 2 ? "top-11" : "top-7"} ${active ? "font-semibold text-fg" : reached ? "text-fg" : "text-faint"}`}>
                <span className="block font-mono">{p.points}</span>
                {p.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* The prize you tapped, and trading for it */}
      <div className="mt-8 min-h-36 sm:mt-24">
        <AnimatePresence mode="wait">
          {won ? (
            <motion.div key="won" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-xl">
              <p className="font-display text-2xl font-bold text-success">{won.prize}: it&apos;s yours!</p>
              {won.kind === "gift-card" ? (
                <>
                  <p className="mt-1 text-muted">A {won.value} gift card to give away. Share the number and PIN; whoever has them can spend it.</p>
                  <p className="mt-4 font-mono text-xl tracking-wider">{won.number}</p>
                  <p className="font-mono text-faint">PIN {won.pin}</p>
                  <CopyButton text={`${won.number} PIN ${won.pin}`} />
                </>
              ) : (
                <p className="mt-1 text-muted">
                  {won.value} off, saved to your wallet below and ready at checkout. Code <span className="whitespace-nowrap font-mono text-fg">{won.number}</span>.
                </p>
              )}
              <button type="button" onClick={() => setWon(null)} className="mt-4 text-sm text-accent-text underline-offset-4 hover:underline">
                Back to prizes
              </button>
            </motion.div>
          ) : open ? (
            <motion.div key={open.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="max-w-xl">
              <p className="font-display text-2xl font-bold">{open.title}</p>
              <p className="mt-1 text-muted">{open.blurb}</p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Button ref={button} onClick={() => trade(open)} disabled={busy || balance < open.points}>
                  {busy ? "Trading…" : `Trade ${open.points} points`}
                </Button>
                {balance < open.points && (
                  <span className="text-sm text-muted">
                    <strong className="text-fg">{open.points - balance}</strong> more to go
                  </span>
                )}
              </div>
              {error && (
                <motion.p role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -6, 6, 0] }} className="mt-3 text-sm text-danger">
                  {error}
                </motion.p>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {history.length > 0 && <History entries={history} />}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(text).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1400)))}
      className="mt-3 rounded-full border border-line px-4 py-1.5 text-sm font-medium transition-[border-color,transform] hover:border-accent-line active:scale-95"
    >
      {copied ? "Copied" : "Copy number and PIN"}
    </button>
  );
}

/** Points earned and spent, newest first; a few at a time. */
function History({ entries }: { entries: PointsEntryView[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? entries : entries.slice(0, 5);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Vancouver" });
  return (
    <div className="mt-10 max-w-xl">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-faint">History</h3>
      <ul className="mt-3 divide-y divide-[var(--sea-wake)]/15">
        {shown.map((e) => (
          <li key={e.id} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
            <span className="min-w-0 truncate">
              {e.label} <span className="text-faint">· {fmt(e.date)}</span>
            </span>
            <span className={`shrink-0 font-mono font-semibold ${e.points > 0 ? "text-success" : "text-muted"}`}>
              {e.points > 0 ? "+" : "−"}
              {Math.abs(e.points)}
            </span>
          </li>
        ))}
      </ul>
      {entries.length > 5 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-sm text-accent-text underline-offset-4 hover:underline">
          {all ? "Show less" : `Show all ${entries.length}`}
        </button>
      )}
    </div>
  );
}
