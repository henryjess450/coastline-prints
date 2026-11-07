"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

/** A number that rolls up or down like a counter when it changes. */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  // Which way to roll: worked out when the value changes (React's "previous value" pattern).
  const [prev, setPrev] = useState(value);
  const [dir, setDir] = useState(1);
  if (value !== prev) {
    setPrev(value);
    setDir(value > prev ? 1 : -1);
  }
  return (
    <span className={`relative inline-flex overflow-hidden ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.span
          key={value}
          custom={dir}
          variants={{ enter: (d: number) => ({ y: d * 14, opacity: 0 }), center: { y: 0, opacity: 1 }, exit: (d: number) => ({ y: d * -14, opacity: 0 }) }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 520, damping: 34 }}
          className="inline-block tabular-nums"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
