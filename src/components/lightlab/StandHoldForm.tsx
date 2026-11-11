"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "@/components/account/use-account";
import { cn } from "@/lib/cn";
import { clock } from "@/lib/shop/markets";
import type { StandDto } from "@/lib/shop/stand";

const field = "h-11 w-full rounded-xl border border-line bg-bg px-3.5 text-sm outline-none focus:border-accent-line";

/**
 * Hold a lamp at the stand for free: pick the half-hour window you'll come by,
 * leave a name and email, and pay at the stand. Once the window ends it's back
 * up for grabs.
 */
export function StandHoldForm({ stand, productId, variantId, label, max }: { stand: StandDto; productId: string; variantId: string | null; label: string; max: number }) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [f, setF] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState<{ token: string; slot: { start: string; end: string } } | null>(null);
  useAccount((a) => {
    if (a.signedIn) setF((x) => ({ ...x, name: x.name || a.name || "", email: x.email || a.email || "" }));
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return setError("Pick the time you'll come by.");
    setBusy(true);
    setError(null);
    const r = await fetch("/api/lightlab/stand/hold", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, variantId, quantity: qty, slotStart: slot, ...f }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setError(d.error ?? "Couldn't hold it. Please try again.");
    setHeld({ token: d.token, slot: stand.windows.find((w) => w.start === slot)! });
  }

  if (held)
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl bg-accent-soft p-3 text-sm" role="status">
        <p className="font-semibold">
          Held! {qty > 1 ? `${qty} × ` : ""}
          {label}, {stand.when} {clock(held.slot.start)} to {clock(held.slot.end)}.
        </p>
        <p className="mt-1 text-muted">Pay at the stand. We emailed you the details. </p>
        <Link href={`/lightlab/hold/${held.token}`} className="mt-1 inline-block text-accent-text underline underline-offset-4">
          See your hold
        </Link>
      </motion.div>
    );

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex h-10 items-center rounded-full border border-fg px-4 text-sm font-semibold transition-transform active:scale-95">
        Hold one, pay at the stand
      </button>
    );

  return (
    <AnimatePresence>
      <motion.form onSubmit={submit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 space-y-4 overflow-hidden">
        <div>
          <p className="text-sm font-medium">When will you come by?</p>
          <p className="text-xs text-muted">We hold it until the end of your half hour. After that it&apos;s back up for grabs.</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Time you'll come by">
            {stand.windows.map((w) => (
              <button key={w.start} type="button" role="radio" aria-checked={slot === w.start} onClick={() => (setSlot(w.start), setError(null))} className={cn("rounded-full border px-3 py-1.5 text-sm tabular-nums transition-colors", slot === w.start ? "border-transparent bg-accent text-accent-ink" : "border-line hover:border-accent-line")}>
                {clock(w.start)}–{clock(w.end)}
              </button>
            ))}
          </div>
        </div>
        {max > 1 && (
          <label className="flex items-center gap-3 text-sm">
            How many
            <select value={qty} onChange={(e) => setQty(Number(e.target.value))} className="h-9 rounded-lg border border-line bg-bg px-2">
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Your name" autoComplete="name" aria-label="Your name" className={field} />
          <input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email" autoComplete="email" aria-label="Email" className={field} />
          <input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Phone (optional)" autoComplete="tel" aria-label="Phone (optional)" className={cn(field, "sm:col-span-2")} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink transition-transform active:scale-95 disabled:opacity-60">
            {busy ? "Holding…" : "Hold it for me"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-fg">
            Cancel
          </button>
        </div>
        <p className="text-xs text-faint">Free. You pay at the stand by card, cash or e-Transfer.</p>
      </motion.form>
    </AnimatePresence>
  );
}
