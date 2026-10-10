"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Ok = { ok: true; orderId: string; orderNumber: string; customer: string; from: string; fromLabel: string; to: string; toLabel: string; emailed: boolean };
type Fail = { ok: false; reason: string; needsTracking?: { orderId: string; orderNumber: string; customer: string } };
type Entry = (Ok & { at: number; undone?: boolean; undo?: boolean }) | (Fail & { at: number });

/** A short beep: high for done, low twice for a problem. */
function beep(good: boolean) {
  try {
    const ctx = new AudioContext();
    const tones = good ? [880] : [220, 220];
    tones.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.value = 0.15;
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.12);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {}
}

async function post(url: string, body: unknown): Promise<Ok | Fail> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const data = res ? await res.json().catch(() => null) : null;
  if (!res?.ok || !data) return { ok: false, reason: data?.error ?? "Couldn't reach the server. Check the connection and scan again." };
  return data;
}

/**
 * The scan station. Leave this open on the computer the barcode scanner is
 * plugged into: the scanner types into the box and presses Enter. Each scan
 * moves the order on one step and prints a stub; Undo puts it back.
 */
export function ScanStation() {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Entry[]>([]);
  const [waiting, setWaiting] = useState<Fail["needsTracking"] | null>(null);
  const focus = useCallback(() => setTimeout(() => input.current?.focus(), 0), []);

  // Keep the box ready for the scanner: back into it whenever the window comes back.
  useEffect(() => {
    focus();
    window.addEventListener("focus", focus);
    const t = setInterval(() => {
      if (document.activeElement === document.body) focus();
    }, 1500);
    return () => {
      window.removeEventListener("focus", focus);
      clearInterval(t);
    };
  }, [focus]);

  // Keep the screen on while the station is open, where the browser allows it.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    void (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => void lock?.release();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = value.trim();
    setValue("");
    if (!code || busy) return;
    setBusy(true);
    // After a tracked parcel, the next scan is its shipping label.
    const result = waiting ? await post("/api/admin/scan", { code: waiting.orderNumber, tracking: code }) : await post("/api/admin/scan", { code });
    setBusy(false);
    if (!result.ok && result.needsTracking) {
      setWaiting(result.needsTracking);
      beep(true);
    } else {
      setWaiting(null);
      beep(result.ok);
    }
    setLog((l) => [{ ...result, at: Date.now() }, ...l].slice(0, 12));
    focus();
  }

  async function undo(entry: Ok & { at: number }) {
    setBusy(true);
    const result = await post("/api/admin/scan/undo", { orderId: entry.orderId, from: entry.from, to: entry.to });
    setBusy(false);
    beep(result.ok);
    setLog((l) => [{ ...result, at: Date.now(), ...(result.ok ? { undo: true } : {}) }, ...l.map((x) => (x === entry ? { ...x, undone: true } : x))].slice(0, 12));
    focus();
  }

  const latest = log[0];

  return (
    <div className="space-y-6">
      <form onSubmit={submit} onClick={focus}>
        <label htmlFor="scan-box" className="mb-2 block text-sm text-muted">
          {waiting ? (
            <span className="font-semibold text-sand">
              Now scan the Canada Post label for {waiting.orderNumber} ({waiting.customer}). Press Enter with the box empty to cancel.
            </span>
          ) : (
            "Scan a ticket's barcode (or type an order number and press Enter)."
          )}
        </label>
        <input
          id="scan-box"
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !value.trim() && waiting) {
              e.preventDefault();
              setWaiting(null);
            }
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder={waiting ? "Tracking number" : "CP-2610-XXXX"}
          className={cn("h-16 w-full rounded-2xl border-2 bg-surface px-5 font-mono text-2xl outline-none", waiting ? "border-sand" : "border-accent-line")}
        />
      </form>

      {/* The last scan, big enough to read from across the room */}
      <AnimatePresence mode="wait">
        {latest && (
          <motion.div
            key={latest.at}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn("rounded-3xl p-6 sm:p-8", latest.ok ? "bg-success/15" : "needsTracking" in latest && latest.needsTracking ? "bg-sand/15" : "bg-danger/15")}
          >
            {latest.ok ? (
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-3xl font-bold sm:text-4xl">{latest.orderNumber}</p>
                  <p className="text-muted">{latest.customer}</p>
                  <p className="mt-3 font-display text-3xl font-bold text-success sm:text-5xl">
                    {"undo" in latest && latest.undo ? "Back to " : ""}
                    {latest.toLabel}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Was {latest.fromLabel}. {latest.emailed ? "The customer is being emailed. " : ""}A stub is printing.
                  </p>
                </div>
                {!("undo" in latest && latest.undo) && !latest.undone && (
                  <button type="button" disabled={busy} onClick={() => void undo(latest)} className="rounded-full border-2 border-line px-6 py-3 font-semibold hover:border-danger hover:text-danger">
                    Undo
                  </button>
                )}
              </div>
            ) : (
              <p className={cn("font-display text-2xl font-bold sm:text-3xl", latest.needsTracking ? "text-sand" : "text-danger")}>{latest.reason}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {log.length > 1 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted">Earlier</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {log.slice(1).map((e) => (
              <li key={e.at} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                {e.ok ? (
                  <>
                    <span>
                      <span className="font-mono font-semibold">{e.orderNumber}</span> <span className="text-muted">{e.customer}</span>
                    </span>
                    <span className={cn("font-medium", e.undone ? "text-faint line-through" : "text-success")}>
                      {e.fromLabel} → {e.toLabel}
                    </span>
                  </>
                ) : (
                  <span className="text-danger">{e.reason}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
