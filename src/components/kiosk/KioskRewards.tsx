"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/cn";

type Prize = { id: string; title: string; points: number; value: string; affordable: boolean };
type Found = { firstName: string; points: number; prizes: Prize[] };
export type Redeemed = { code: string; label: string };

async function call<T>(method: string, body?: object, query = ""): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/kiosk/rewards${query}`, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: data as T } : { ok: false, error: data.error ?? "Something went wrong." };
  } catch {
    return { ok: false, error: "Can't reach the internet right now." };
  }
}

/**
 * "Got points?" on the kiosk: a phone number or email brings up their first
 * name and points, and a tap spends them on money off this sale. One prize per sale.
 */
export function KioskRewards({ redeemed, onRedeem, onUndo, onFound }: { redeemed: Redeemed | null; onRedeem: (r: Redeemed) => void; onUndo: () => void; onFound: (firstName: string, byEmail: string | null) => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    if (q.trim().length < 3 || busy) return;
    setBusy(true);
    setError(null);
    const r = await call<Found>("POST", { q });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setFound(r.data);
    onFound(r.data.firstName, q.includes("@") ? q.trim() : null);
  }

  async function redeem(p: Prize) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await call<{ code: string; label: string; points: number }>("PUT", { q, prizeId: p.id });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setFound((f) => (f ? { ...f, points: r.data.points, prizes: f.prizes.map((x) => ({ ...x, affordable: r.data.points >= x.points })) } : f));
    onRedeem({ code: r.data.code, label: r.data.label });
  }

  function undo() {
    if (!redeemed) return;
    void call("DELETE", undefined, `?code=${encodeURIComponent(redeemed.code)}`);
    const back = found?.prizes.find((p) => p.title === redeemed.label)?.points ?? 0;
    setFound((f) => (f ? { ...f, points: f.points + back, prizes: f.prizes.map((x) => ({ ...x, affordable: f.points + back >= x.points })) } : f));
    onUndo();
  }

  const canGet = found?.prizes.filter((p) => p.affordable) ?? [];
  const next = found?.prizes.find((p) => !p.affordable);

  return (
    <div className="rounded-3xl border-2 border-line bg-surface p-5">
      {!found ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void find();
          }}
        >
          <p className="text-lg font-semibold">Got rewards points?</p>
          <p className="text-muted">Type your phone number or email to use them.</p>
          <div className="mt-3 flex gap-3">
            <input value={q} onChange={(e) => (setQ(e.target.value), setError(null))} placeholder="Phone number or email" autoComplete="off" autoCapitalize="off" aria-label="Phone number or email" className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-line bg-bg px-4 text-xl outline-none focus:border-accent-line" />
            <button type="submit" disabled={busy || q.trim().length < 3} className="h-14 rounded-full bg-fg px-6 text-lg font-bold text-bg disabled:opacity-40">
              {busy ? "Looking…" : "Find me"}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <p className="text-2xl font-bold">
            Hi{found.firstName ? ` ${found.firstName}` : ""}! You have <span className="text-accent-text tabular-nums">{found.points}</span> points.
          </p>
          <AnimatePresence mode="wait" initial={false}>
            {redeemed ? (
              <motion.div key="done" className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-success/15 px-4 py-3 text-success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <span className="text-lg font-semibold">✓ {redeemed.label} added to this sale</span>
                <button type="button" onClick={undo} className="text-sm font-semibold underline underline-offset-4">
                  Undo
                </button>
              </motion.div>
            ) : canGet.length ? (
              <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="mt-1 text-muted">Want to use some of them now?</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {canGet.map((p) => (
                    <motion.button key={p.id} type="button" whileTap={{ scale: 0.95 }} disabled={busy} onClick={() => redeem(p)} className={cn("rounded-2xl border-2 border-accent-line bg-accent-soft px-5 py-3 text-left disabled:opacity-50")}>
                      <span className="block text-lg font-bold">{p.title}</span>
                      <span className="block text-sm text-muted">{p.points} points</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.p key="none" className="mt-1 text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {next ? `${next.points - found.points} more points for ${next.title}. This sale earns you more!` : "This sale earns you more points."}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
      {error && <p className="mt-2 text-danger">{error}</p>}
    </div>
  );
}
