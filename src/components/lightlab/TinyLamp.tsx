"use client";
import { motion } from "framer-motion";

/** A little desk lamp that switches on (bulb glows, light spills down) when `on`. */
export function TinyLamp({ on, size = 40 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0 overflow-visible">
      <defs>
        <radialGradient id="tl-glow" cx="50%" cy="0%" r="100%">
          <stop offset="0%" stopColor="#ffd98a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* the light spilling out under the shade */}
      <motion.path d="M11 17 L4 38 H36 L29 17 Z" fill="url(#tl-glow)" initial={false} animate={{ opacity: on ? 0.55 : 0 }} transition={{ duration: 0.5 }} />
      {/* shade */}
      <path d="M12 17 Q20 3 28 17 Z" fill="currentColor" opacity="0.85" />
      {/* bulb */}
      <motion.circle cx="20" cy="18.5" r="2.6" initial={false} animate={{ fill: on ? "#ffd98a" : "rgb(128 128 128 / 0.5)", filter: on ? "drop-shadow(0 0 4px #ffd98a)" : "drop-shadow(0 0 0px #ffd98a)" }} transition={{ duration: 0.4 }} />
      {/* stand */}
      <path d="M20 21 V34 M14 36 H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}
