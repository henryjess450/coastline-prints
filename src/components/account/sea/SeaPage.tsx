"use client";
/**
 * The account page is the sea. Sky and sun at the top, the water surface
 * under the greeting, then solid bands of water, each a shade deeper, all
 * the way down the page, slowly moving. Drawn in page pixels in one SVG
 * behind the content. Reduced motion: one still frame.
 */
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Gull } from "@/components/brand/Benchy";

const SAND = "#e9c46a";
const BANDS = ["var(--sea-1)", "var(--sea-2)", "var(--sea-3)", "var(--sea-4)"];

const waveY = (x: number, base: number, amp: number, period: number, phase: number) => base + amp * Math.sin(((x + phase) / period) * Math.PI * 2);

/** A wavy-topped band from `base` down to `bottom`. */
function band(w: number, bottom: number, base: number, amp: number, period: number, phase: number) {
  let d = `M-10 ${bottom} L-10 ${waveY(-10, base, amp, period, phase).toFixed(1)}`;
  for (let x = 0; x <= w + 20; x += 12) d += ` L${x} ${waveY(x, base, amp, period, phase).toFixed(1)}`;
  return `${d} L${w + 20} ${bottom} Z`;
}

/** `hero` sits in the sky; the water surface starts just below it. */
export function SeaPage({ hero, children }: { hero: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroH, setHeroH] = useState(280);
  const reduce = useReducedMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [time, setTime] = useState(0);
  useEffect(() => {
    const el = ref.current;
    const hero = heroRef.current;
    if (!el || !hero) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      setHeroH(hero.offsetHeight);
    });
    ro.observe(el);
    ro.observe(hero);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    let last = 0;
    // The water moves slowly, so 30 redraws a second is plenty (and half the work on phones).
    const tick = (now: number) => {
      if (now - last >= 32) {
        last = now;
        setTime((now - start) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const { w, h } = size;
  const surface = heroH + 24;
  const t = reduce ? 6 : time;
  const ph = t * 30;
  const scale = Math.max(0.55, Math.min(1, w / 1300));

  // The surface waves under the greeting.
  const surf = { base: surface, amp: 9, period: 260, phase: ph * 0.6 };
  const swell = { base: surface + 22, amp: 11, period: 320, phase: -ph };

  // Deeper bands, evenly down the rest of the page.
  const depthTop = surface + 120;
  const step = Math.max(240, (h - depthTop) / BANDS.length);

  return (
    <div ref={ref} className="relative isolate">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        {w > 0 && (
          <svg width={w} height={h} className="block">
            {/* Sky */}
            {/* On phones the sun sits low on the horizon, half behind the waves, clear of the text. */}
            <circle cx={w * (w >= 640 ? 0.86 : 0.8)} cy={w >= 640 ? surface * 0.36 : surface + 2} r={34 * scale + 6} fill={SAND} />
            {[0, 0.4, 0.7].map((off, i) => {
              const k = (t / 22 + off) % 1;
              return <Gull key={i} x={-60 + k * (w + 120)} y={surface * (0.18 + i * 0.09) + 6 * Math.sin(t * 0.9 + i)} flap={Math.sin(t * Math.PI * 2 * (1.4 + i * 0.12))} size={(1 - i * 0.12) * scale} />;
            })}

            {/* The surface, then each deeper band */}
            <path d={band(w, h, surf.base, surf.amp, surf.period, surf.phase)} fill="var(--sea-foam)" />
            <path d={band(w, h, swell.base, swell.amp, swell.period, swell.phase)} fill="var(--sea-0)" />
            {BANDS.map((fill, i) => (
              <path key={i} d={band(w, h, depthTop + step * i, 12 - i, 300 + i * 40, (i % 2 ? -1 : 1) * ph * (0.4 + i * 0.1))} fill={fill} />
            ))}

            {/* Wavy bottom edge into the page colour */}
            <path d={band(w, h + 40, h - 22, 8, 360, -ph * 0.5)} fill="var(--bg)" />
          </svg>
        )}
      </div>
      <div ref={heroRef}>{hero}</div>
      {children}
    </div>
  );
}
