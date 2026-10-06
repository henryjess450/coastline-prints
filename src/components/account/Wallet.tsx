"use client";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { WalletItem } from "@/lib/account/wallet";

/**
 * Saved gift cards and coupons. Gift cards are dealt in like a hand of cards,
 * tilt toward the pointer, catch a shine on hover and flip over on tap to show
 * their details. Coupons are tickets that wiggle. Spent or expired ones are
 * greyed out.
 */
export function Wallet({ items }: { items: WalletItem[]; highlight?: string | null }) {
  if (!items.length)
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border-2 border-dashed border-line-strong p-8 text-center">
        <motion.div className="mx-auto mb-3 h-12 w-20 rounded-lg border-2 border-dashed border-line-strong" animate={{ rotate: [-4, 4, -4] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} aria-hidden />
        <p className="text-sm text-muted">Nothing saved yet. Gift cards and coupons you save will show up here.</p>
      </motion.div>
    );
  return (
    <ul className="grid gap-5 sm:grid-cols-2">
      <AnimatePresence initial>
        {items.map((it, i) => (
          <motion.li
            key={it.code}
            layout
            // Dealt in from the top left, one after another.
            initial={{ opacity: 0, x: -140, y: -70, rotate: -22, scale: 0.85 }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ delay: 0.15 + Math.min(i, 8) * 0.12, type: "spring", stiffness: 220, damping: 20 }}
          >
            {it.kind === "GIFT_CARD" ? <GiftCard it={it} /> : <Ticket it={it} />}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

/** A navy gift card that tilts toward the pointer and flips over when tapped. */
function GiftCard({ it }: { it: WalletItem }) {
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [10, -10]), { stiffness: 220, damping: 18 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-12, 12]), { stiffness: 220, damping: 18 });
  const balance = it.balanceCents != null ? `$${(it.balanceCents / 100).toFixed(2)}` : "";

  return (
    <motion.button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      onPointerMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => (px.set(0.5), py.set(0.5))}
      aria-label={`${it.title}, card ${it.number}. Tap to ${flipped ? "show the front" : "see details"}.`}
      className="group block w-full text-left [perspective:900px]"
      style={{ rotateX: reduce ? 0 : rotateX, rotateY: reduce ? 0 : rotateY }}
      whileTap={{ scale: 0.97 }}
    >
      <motion.div className="relative aspect-[1.586] w-full [transform-style:preserve-3d]" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: "spring", stiffness: 180, damping: 18 }}>
        {/* Front */}
        <div className={cn("absolute inset-0 overflow-hidden rounded-2xl bg-accent p-5 text-accent-ink shadow-[var(--shadow)] [backface-visibility:hidden]", !it.usable && "opacity-50 grayscale")}>
          {/* Shine that sweeps across on hover */}
          <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 -skew-x-12 bg-white/15 transition-transform duration-700 ease-out group-hover:translate-x-[520%]" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lettering/gift-card-blue.png" alt="" className="h-7 w-auto" />
          <svg width="40" height="40" viewBox="0 0 32 32" className="absolute right-4 top-4" aria-hidden>
            <circle cx="16" cy="16" r="15" fill="#0a3156" />
            <path d="M5 17c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0 2.2 2 2.2 2" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M7 22.5c1.8-1.5 3.6-1.5 5.4 0s3.6 1.5 5.4 0 3.6-1.5 5.4 0" stroke="#86bbea" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <circle cx="21.5" cy="10" r="3" fill="#e9c46a" />
          </svg>
          <p className="absolute bottom-5 left-5 font-mono text-sm tracking-wider text-white/80">{it.number}</p>
          <p className="absolute bottom-4 right-5 font-display text-2xl font-bold text-sand">{balance}</p>
          {!it.usable && <p className="absolute right-5 top-16 rounded-full bg-black/40 px-2.5 py-0.5 text-xs">{it.reason}</p>}
        </div>
        {/* Back */}
        <div className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-accent-line bg-elev p-5 shadow-[var(--shadow)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div>
            <p className="font-display text-lg font-bold">{it.title}</p>
            {it.detail && <p className="mt-1 text-sm text-muted">{it.detail}</p>}
          </div>
          <div>
            <p className="font-mono text-sm tracking-wider">{it.number}</p>
            <p className="mt-1 text-xs text-accent-text">{it.usable ? "Ready to tap at checkout. Locked to your account." : it.reason}</p>
          </div>
        </div>
      </motion.div>
    </motion.button>
  );
}

/** A coupon ticket with punched notches; it wiggles when you hover or tap it. */
function Ticket({ it }: { it: WalletItem }) {
  return (
    <motion.div
      className={cn("relative h-full overflow-hidden rounded-2xl bg-accent-soft p-5 pl-7", !it.usable && "opacity-50")}
      whileHover={{ rotate: [0, -2.5, 2.5, -1.5, 0], y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.5 }}
    >
      {/* Punched notches and a perforated line */}
      <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-bg" aria-hidden />
      <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-bg" aria-hidden />
      <span className="absolute inset-y-3 left-[72%] border-l-2 border-dashed border-accent-line/50" aria-hidden />
      <div className="pr-[30%]">
        <p className="font-display text-lg font-bold">{it.title}</p>
        {it.detail && <p className="mt-1 text-sm text-muted">{it.detail}</p>}
        <p className="mt-4 font-mono text-sm tracking-wider text-muted">{it.number}</p>
        {!it.usable && <p className="mt-2 text-xs text-faint">{it.reason}</p>}
      </div>
      <motion.svg
        width="44"
        height="44"
        viewBox="0 0 24 24"
        className="absolute right-[7%] top-1/2 -translate-y-1/2 text-accent-text"
        animate={{ rotate: [0, 12, 0, -12, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      >
        <path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 9l6 6M15 9h0M9 15h0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </motion.svg>
    </motion.div>
  );
}
