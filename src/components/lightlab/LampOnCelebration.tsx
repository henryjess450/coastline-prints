"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { LampRing } from "@/components/admin/lamp/LampRing";
import { play } from "@/lib/feel";
import type { LampAnim } from "@/lib/lamp/animations";

/**
 * A LightLab order is in: a pendant lamp's cord is tugged, the bulb switches
 * on and a soft glow bursts out. Underneath, the shop's own order lamp plays
 * the same pattern it just played for this order. One time through, no loop.
 */
export function LampOnCelebration({ anim, dollars, lampPlayed }: { anim: LampAnim; dollars: number; /** False in the lamp's quiet hours. */ lampPlayed: boolean }) {
  const still = useReducedMotion();
  const [on, setOn] = useState(!!still);
  useEffect(() => {
    if (still) return;
    const t = setTimeout(() => (setOn(true), play("chime")), 900);
    return () => clearTimeout(t);
  }, [still]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-44 w-44">
        {/* the glow burst: two soft rings opening out, then a steady warm halo */}
        {on && !still && (
          <>
            <motion.span aria-hidden className="absolute left-1/2 top-[62%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#ffd98a]" initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 1.1, ease: "easeOut" }} />
            <motion.span aria-hidden className="absolute left-1/2 top-[62%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ffd98a]" initial={{ scale: 0.2, opacity: 0.7 }} animate={{ scale: 2.8, opacity: 0 }} transition={{ duration: 1.5, ease: "easeOut", delay: 0.15 }} />
          </>
        )}
        <motion.span aria-hidden className="absolute left-1/2 top-[62%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle, rgb(255 217 138 / 0.55), rgb(255 217 138 / 0) 65%)" }} initial={false} animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.6 }} transition={{ duration: 0.7 }} />
        <svg viewBox="0 0 120 140" className="relative h-full w-full text-fg" aria-hidden>
          {/* cord from the ceiling */}
          <line x1="60" y1="0" x2="60" y2="52" stroke="currentColor" strokeWidth="1.5" />
          {/* shade */}
          <path d="M34 82 Q38 52 60 52 Q82 52 86 82 Z" fill="currentColor" />
          {/* bulb */}
          <motion.circle cx="60" cy="88" r="9" initial={false} animate={{ fill: on ? "#ffd98a" : "#6b7280" }} transition={{ duration: 0.25 }} style={{ filter: on ? "drop-shadow(0 0 10px #ffd98a)" : "none" }} />
          {/* pull cord: tugged down once, then springs back */}
          <motion.g initial={{ y: 0 }} animate={still ? undefined : { y: [0, 0, 12, -3, 0] }} transition={{ duration: 1.3, times: [0, 0.45, 0.62, 0.8, 1], ease: "easeInOut" }}>
            <line x1="78" y1="80" x2="78" y2="112" stroke="currentColor" strokeWidth="1" opacity="0.7" />
            <circle cx="78" cy="115" r="3.2" fill="currentColor" />
          </motion.g>
        </svg>
      </div>
      {lampPlayed && (
        <motion.div className="mt-4 flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 text-left text-xs text-muted" initial={{ opacity: 0, y: 8 }} animate={{ opacity: on ? 1 : 0, y: on ? 0 : 8 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <LampRing anim={anim} value={dollars} size={36} />
          <span>The lamp at our workshop just lit up like this for your order.</span>
        </motion.div>
      )}
    </div>
  );
}
