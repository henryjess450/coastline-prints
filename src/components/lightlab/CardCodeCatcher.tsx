"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { play } from "@/lib/feel";

/** Where checkout looks for a scanned thank-you card's coupon to add by itself. */
export const CARD_CODE_KEY = "cp-card-code";

/**
 * A thank-you card's QR opens /lightlab?code=…: keep the coupon for checkout,
 * tidy the address bar, and say so with a little note that floats up.
 */
export function CardCodeCatcher() {
  const [saved, setSaved] = useState<{ percent: number | null } | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code")?.replace(/\D/g, "");
    if (!code || code.length < 8 || code.length > 16) return;
    url.searchParams.delete("code");
    window.history.replaceState(window.history.state, "", url);
    fetch("/api/codes/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) return;
        try {
          localStorage.setItem(CARD_CODE_KEY, code);
        } catch {}
        setSaved({ percent: body.code?.percentOff ?? null });
        play("chime");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 6000);
    return () => clearTimeout(t);
  }, [saved]);

  return (
    <AnimatePresence>
      {saved && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-2xl"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-lg text-accent-ink">✦</span>
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{saved.percent ? `${saved.percent}% off is saved` : "Your coupon is saved"}</p>
            <p className="text-muted">It&apos;s added for you at checkout. Thanks for coming back!</p>
          </div>
          <button type="button" onClick={() => setSaved(null)} aria-label="Close" className="ml-auto self-start text-muted hover:text-fg">
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
