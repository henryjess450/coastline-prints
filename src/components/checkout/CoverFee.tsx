"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { cardFeeWhy, type CardFeeSettings } from "@/lib/pos/card-fee";

export const COVER_FEE_QUESTION = "Would you like to cover our payment processing fees for this order?";

/** The card fee settings (null while loading, or if they can't be read: then nothing is asked or added). */
export function useCardFee() {
  const [fee, setFee] = useState<CardFeeSettings | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/card-fee")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CardFeeSettings | null) => live && setFee(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return fee;
}

/**
 * Asked whenever someone pays by card and the fee is switched on: yes adds the
 * fee as its own line, no adds nothing. Has to be answered before paying.
 */
export function CoverFee({ fee, feeCents, value, onChange, error, size = "md", className }: { fee: CardFeeSettings; feeCents: number; value: boolean | null; onChange: (v: boolean) => void; /** Shown when they tried to pay without answering. */ error?: boolean; /** "lg" for the kiosk and the customer display. */ size?: "md" | "lg"; className?: string }) {
  const big = size === "lg";
  return (
    <fieldset className={cn("rounded-2xl border p-4", error && value == null ? "border-danger/60" : "border-line", className)}>
      <legend className={cn("px-1 font-medium", big ? "text-xl" : "text-sm")}>{COVER_FEE_QUESTION}</legend>
      <p className={cn("mt-1 text-muted", big ? "text-base" : "text-xs")}>{cardFeeWhy(fee)} It&apos;s up to you.</p>
      <div className={cn("mt-3 grid grid-cols-2", big ? "gap-3" : "gap-2")}>
        {[true, false].map((yes) => {
          const on = value === yes;
          return (
            <button
              key={String(yes)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(yes)}
              className={cn("relative rounded-full border font-semibold transition-[border-color,transform] active:scale-95", big ? "px-5 py-4 text-lg" : "px-4 py-2.5 text-sm", on ? "border-transparent text-accent-ink" : "border-line hover:border-accent-line")}
            >
              {on && <motion.span layoutId={`cover-fee-${size}`} className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
              <span className="relative">{yes ? `Yes, add ${money(feeCents)}` : "No thanks"}</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {error && value == null && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 text-xs text-danger" role="alert">
            Please choose yes or no first.
          </motion.p>
        )}
      </AnimatePresence>
    </fieldset>
  );
}
