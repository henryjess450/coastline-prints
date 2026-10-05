"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["#0e4471", "#3d7bb8", "#86bbea", "#e9c46a", "#4fb3a9", "#ffffff"];

/** Animated checkmark with a one-time confetti burst (skipped for reduced motion). */
export function Celebration() {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => {
        const angle = (i / 70) * Math.PI * 2 + (i % 3) * 0.3;
        const dist = 120 + ((i * 37) % 160);
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.7 - 60,
          fall: 180 + ((i * 53) % 220),
          rotate: ((i * 97) % 720) - 360,
          color: COLORS[i % COLORS.length],
          w: 6 + (i % 4) * 2,
          h: i % 2 ? 10 : 6,
          round: i % 5 === 0,
          delay: (i % 10) * 0.012,
        };
      }),
    [],
  );

  return (
    <div className="relative mx-auto grid h-28 w-28 place-items-center" aria-hidden>
      {!reduce &&
        pieces.map((p, i) => (
          <motion.span
            key={i}
            className="pointer-events-none absolute left-1/2 top-1/2"
            style={{ width: p.w, height: p.h, background: p.color, borderRadius: p.round ? 999 : 2 }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
            animate={{ x: [0, p.x, p.x * 1.1], y: [0, p.y, p.y + p.fall], opacity: [1, 1, 0], rotate: p.rotate, scale: 1 }}
            transition={{ duration: 1.8, delay: 0.25 + p.delay, ease: ["easeOut", "easeIn"], times: [0, 0.35, 1] }}
          />
        ))}
      <motion.div
        className="grid h-24 w-24 place-items-center rounded-full bg-accent shadow-[var(--btn-glow)]"
        initial={{ scale: reduce ? 1 : 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
      >
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M5 13l4 4L19 7" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.45, ease: "easeOut" }} />
        </svg>
      </motion.div>
    </div>
  );
}
