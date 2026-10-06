"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Prize } from "@config/rewards";
import { AnimatedCount } from "@/components/motion/AnimatedCount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type Summary = { balance: number; pending: number; history: { id: string; points: number; label: string; date: string }[] };
type Result = { prize: string; kind: Prize["kind"]; value: string; number: string; pin: string | null; balance: number };

/** Points balance, progress to the next prize, the prize list, and history. */
export function RewardsBoard({ prizes, summary, signedIn }: { prizes: (Prize & { value: string })[]; summary: Summary | null; signedIn: boolean }) {
  const router = useRouter();
  const [balance, setBalance] = useState(summary?.balance ?? 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const next = prizes.find((p) => p.points > balance);
  const prev = [...prizes].reverse().find((p) => p.points <= balance);
  const progress = next ? Math.min(1, (balance - (prev?.points ?? 0)) / (next.points - (prev?.points ?? 0))) : 1;

  async function redeem(id: string) {
    setBusy(id);
    setError("");
    const res = await fetch("/api/rewards/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prizeId: id }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    setConfirm(null);
    if (!res.ok) return setError(data.error ?? "That didn't work. Please try again.");
    setResult(data.result);
    setBalance(data.result.balance);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {signedIn && summary && (
        <Card flat className="p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm text-muted">Your points</p>
              <p className="font-display text-6xl font-bold tabular-nums text-accent-text">
                <AnimatedCount value={balance} />
              </p>
              {summary.pending > 0 && <p className="mt-1 text-sm text-faint">+{summary.pending} more on the way when your current orders are picked up</p>}
            </div>
            <div className="w-full max-w-sm">
              <p className="mb-2 text-sm text-muted">{next ? `${next.points - balance} points to ${next.title}` : "You can pick any prize!"}</p>
              <div className="h-3 overflow-hidden rounded-full bg-surface-strong">
                <motion.div className="h-full rounded-full bg-accent-line" initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ type: "spring", stiffness: 60, damping: 18, delay: 0.3 }} />
              </div>
            </div>
          </div>
        </Card>
      )}

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, scale: 0.94, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>
            <Card flat highlight className="p-6 sm:p-8">
              <p className="font-display text-2xl font-bold">{result.prize} is yours!</p>
              {result.kind === "gift-card" ? (
                <>
                  <p className="mt-2 leading-relaxed text-muted">Give this gift card to a friend. They enter the number and PIN at checkout, or save it to their own account at coastlineprints.ca/redeem.</p>
                  <p className="mt-4 font-mono text-xl font-semibold">{result.number}</p>
                  <p className="font-mono text-lg">PIN {result.pin}</p>
                </>
              ) : (
                <p className="mt-2 leading-relaxed text-muted">
                  It&apos;s saved to your account ({result.number}). At checkout, tap it under &ldquo;Saved to your account&rdquo;.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/order" className="btn btn-primary h-11 px-5 text-sm">
                  Start an order
                </Link>
                <button type="button" onClick={() => setResult(null)} className="btn btn-secondary h-11 px-5 text-sm">
                  Done
                </button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      {error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {prizes.map((p, i) => {
          const can = signedIn && balance >= p.points;
          return (
            <motion.li key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className={cn("flex h-full flex-col rounded-3xl border bg-surface p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow)]", can ? "border-accent-line" : "border-line")}>
                <p className="font-mono text-sm font-semibold text-accent-text">{p.points} points</p>
                <p className="mt-2 font-display text-2xl font-bold">{p.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{p.blurb}</p>
                <div className="mt-auto pt-6">
                  {!signedIn ? (
                    <p className="text-xs text-faint">{p.value}</p>
                  ) : confirm === p.id ? (
                    <div className="flex gap-2">
                      <Button size="sm" disabled={!!busy} onClick={() => void redeem(p.id)}>
                        {busy === p.id ? "Getting it…" : `Use ${p.points} points`}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant={can ? "primary" : "secondary"} disabled={!can} onClick={() => setConfirm(p.id)}>
                      {can ? "Get it" : `${p.points - balance} more points`}
                    </Button>
                  )}
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>

      {signedIn && summary && summary.history.length > 0 && (
        <Card flat className="p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">History</h2>
          <ul className="mt-4 divide-y divide-line">
            {summary.history.map((h) => (
              <li key={h.id} className="flex justify-between py-3 text-sm">
                <span>
                  {h.label} <span className="ml-2 text-faint">{new Date(h.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
                </span>
                <span className={cn("font-mono font-semibold", h.points > 0 ? "text-success" : "text-muted")}>{h.points > 0 ? `+${h.points}` : h.points}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card flat className="p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold">How it works</h2>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
          <li>You get 2 points for every $1 you spend on a print order. They&apos;re added when you pick it up.</li>
          <li>Points are linked to the email you order with, so they count even before you make an account.</li>
          <li>Prizes are saved straight to your account and last 180 days. The gift card prize can be given away.</li>
        </ul>
      </Card>
    </div>
  );
}
