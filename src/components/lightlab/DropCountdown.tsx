"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { dropLabel } from "@/lib/shop/drop-time";

const pad = (n: number) => String(n).padStart(2, "0");

/** "Drops in 2d 04:12:09", ticking each second, then hands over when it hits zero. */
export function DropCountdown({ at, onDropped }: { at: string; onDropped: () => void }) {
  const end = new Date(at).getTime();
  // Starts empty so the server and browser render the same, then ticks.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (now != null && now >= end) onDropped();
  }, [now, end, onDropped]);
  const ms = now == null ? null : Math.max(0, end - now);
  const parts = ms == null ? null : { d: Math.floor(ms / 86_400_000), h: Math.floor(ms / 3_600_000) % 24, m: Math.floor(ms / 60_000) % 60, s: Math.floor(ms / 1000) % 60 };
  return (
    <div className="mt-6">
      {/* Written out once in the browser, so server and browser date formats can't disagree. */}
      <p className="min-h-5 text-sm text-muted">{now != null && `Drops ${dropLabel(at)} (Victoria time)`}</p>
      <p className="mt-2 flex items-baseline gap-3 font-display text-4xl font-bold tabular-nums" aria-live="off">
        {parts ? (
          <>
            {parts.d > 0 && (
              <span>
                {parts.d}
                <span className="text-lg font-medium text-muted">d</span>
              </span>
            )}
            <span>
              {pad(parts.h)}:{pad(parts.m)}:
              <motion.span key={parts.s} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                {pad(parts.s)}
              </motion.span>
            </span>
          </>
        ) : (
          <span className="text-muted">--:--:--</span>
        )}
      </p>
    </div>
  );
}
