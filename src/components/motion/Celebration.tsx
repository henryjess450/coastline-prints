"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["#0e4471", "#3d7bb8", "#86bbea", "#e9c46a", "#4fb3a9", "#ffffff"];

/** The circle mark drawing itself in, with a check and a one-time confetti burst (skipped for reduced motion). */
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
            style={{
              width: p.w,
              height: p.h,
              background: p.color,
              borderRadius: p.round ? 999 : 2,
            }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
            animate={{
              x: [0, p.x, p.x * 1.1],
              y: [0, p.y, p.y + p.fall],
              opacity: [1, 1, 0],
              rotate: p.rotate,
              scale: 1,
            }}
            transition={{
              duration: 1.8,
              delay: 0.25 + p.delay,
              ease: ["easeOut", "easeIn"],
              times: [0, 0.35, 1],
            }}
          />
        ))}
      {/* The circle mark: it pops in, its waves draw once, the sun rises, then a check lands. */}
      <motion.svg
        width="104"
        height="104"
        viewBox="0 0 32 32"
        className="overflow-visible"
        initial={{ scale: reduce ? 1 : 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
      >
        <circle cx="16" cy="16" r="15" fill="#0e4471" />
        <motion.circle
          cx="21.5"
          r="3"
          fill="#e9c46a"
          initial={{ cy: reduce ? 10 : 15, opacity: reduce ? 1 : 0 }}
          animate={{ cy: 10, opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.5, ease: "easeOut" }}
        />
        <motion.path
          d="M5 17c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0 2.2 2 2.2 2"
          stroke="#ffffff"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.3, duration: 0.55, ease: "easeInOut" }}
        />
        <motion.path
          d="M7 22.5c1.8-1.5 3.6-1.5 5.4 0s3.6 1.5 5.4 0 3.6-1.5 5.4 0"
          stroke="#86bbea"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.5, duration: 0.5, ease: "easeInOut" }}
        />
        <motion.g
          initial={{ scale: reduce ? 1 : 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: 1.1,
            type: "spring",
            stiffness: 500,
            damping: 14,
          }}
          style={{ originX: "27px", originY: "27px" }}
        >
          <circle cx="27" cy="27" r="5" fill="var(--success)" stroke="var(--bg)" strokeWidth="1.2" />
          <path d="M24.8 27.1l1.5 1.5 3-3.2" fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </motion.g>
      </motion.svg>
    </div>
  );
}
