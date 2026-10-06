"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["#0e4471", "#3d7bb8", "#86bbea", "#e9c46a", "#4fb3a9", "#df4a42"];

/** A one-time burst of brand-coloured confetti from the top of the screen. */
export function Confetti({ count = 90 }: { count?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: ((i * 61) % 100) - 50,
        drift: ((i * 37) % 30) - 15,
        fall: 70 + ((i * 53) % 40),
        rotate: ((i * 97) % 900) - 450,
        color: COLORS[i % COLORS.length],
        w: 6 + (i % 4) * 2,
        h: i % 2 ? 12 : 7,
        round: i % 5 === 0,
        delay: (i % 12) * 0.035,
        duration: 1.8 + ((i * 7) % 10) / 10,
      })),
    [count],
  );
  if (reduce) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-0"
          style={{ width: p.w, height: p.h, background: p.color, borderRadius: p.round ? 999 : 2 }}
          initial={{ x: 0, y: -20, opacity: 1, rotate: 0 }}
          animate={{ x: [`${0}vw`, `${p.x}vw`, `${p.x + p.drift}vw`], y: ["-2vh", "20vh", `${p.fall}vh`], opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: ["easeOut", "easeIn"], times: [0, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
