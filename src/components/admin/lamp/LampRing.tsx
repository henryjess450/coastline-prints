"use client";
import { useEffect, useRef } from "react";
import { LAMP_ANIMS, N, calmSea, dark, type LampAnim, type Rgb } from "@/lib/lamp/animations";
import { cn } from "@/lib/cn";

/** Dark gap between replays. Every animation starts and ends dark, so the loop is seamless. */
const GAP_S = 0.9;

/**
 * A drawing of the LED ring playing an animation on loop, using the same
 * frame functions as the lamp. LED 0 sits at the bottom.
 */
export function LampRing({ anim, size = 120, className }: { anim: LampAnim | "calm" | "off"; size?: number; className?: string }) {
  const dots = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const paint = (frame: Rgb[]) =>
      frame.forEach((c, i) => {
        const el = dots.current[i];
        if (!el) return;
        const [r, g, b] = c.map((v) => Math.min(255, Math.round(v)));
        const lit = r + g + b > 6;
        el.style.background = lit ? `rgb(${r} ${g} ${b})` : "";
        el.style.boxShadow = lit ? `0 0 ${Math.round(size / 9)}px rgb(${r} ${g} ${b} / ${Math.min(1, (r + g + b) / 300)})` : "";
      });
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (anim === "off") return paint(dark());
    const frameAt = (t: number) => {
      if (anim === "calm") return calmSea(t);
      const a = LAMP_ANIMS[anim];
      const u = t % (a.seconds + GAP_S);
      return u < a.seconds ? a.frame(u) : dark();
    };
    if (still) return paint(anim === "calm" ? calmSea(0) : LAMP_ANIMS[anim].frame(LAMP_ANIMS[anim].seconds * 0.4));
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      paint(frameAt((now - start) / 1000));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anim, size]);

  const dot = Math.max(8, Math.round(size / 8.5));
  const radius = size / 2 - dot / 2 - 2;
  return (
    <div aria-hidden className={cn("relative shrink-0 rounded-full bg-[#070d14]", className)} style={{ width: size, height: size }}>
      {Array.from({ length: N }, (_, i) => {
        const a = Math.PI / 2 + (i * 2 * Math.PI) / N;
        return (
          <span
            key={i}
            ref={(el) => {
              dots.current[i] = el;
            }}
            className="absolute rounded-full border border-white/10 bg-[#141c26]"
            style={{ width: dot, height: dot, left: size / 2 + radius * Math.cos(a) - dot / 2, top: size / 2 + radius * Math.sin(a) - dot / 2 }}
          />
        );
      })}
    </div>
  );
}
