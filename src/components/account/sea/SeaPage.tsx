"use client";
/**
 * The account page is the sea. Sky and sun at the top, the water surface
 * under the greeting, then one band of water per section, each a shade
 * deeper, with a moving wave between every two sections. Drawn in page pixels in one SVG
 * behind the content. Reduced motion: one still frame.
 */
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Bat, Gull } from "@/components/brand/Benchy";
import { useSeason } from "@/components/season/SeasonContext";

const SAND = "#e9c46a";
/** Water for each section after the first, deeper each time (the deepest repeats if there are more). */
const BANDS = ["var(--sea-1)", "var(--sea-2)", "var(--sea-3)", "var(--sea-4)"];
/** How far below a section's top edge its wave sits (inside the section's top padding). */
const WAVE_INSET = 10;

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
  const season = useSeason();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [time, setTime] = useState(0);
  // Where each section starts, in page pixels, so every section gets its own band.
  const [tops, setTops] = useState<number[]>([]);
  useEffect(() => {
    const el = ref.current;
    const hero = heroRef.current;
    if (!el || !hero) return;
    const sections = () => [...el.querySelectorAll<HTMLElement>("section")].filter((s) => !hero.contains(s) && !s.parentElement?.closest("section"));
    const measure = () => {
      const top = el.getBoundingClientRect().top;
      setSize({ w: el.clientWidth, h: el.clientHeight });
      setHeroH(hero.offsetHeight);
      setTops(sections().map((s) => Math.round(s.getBoundingClientRect().top - top)));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(hero);
    // A section changing height moves every section below it.
    sections().forEach((s) => ro.observe(s));
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
              const at = { x: -60 + k * (w + 120), y: surface * (0.18 + i * 0.09) + 6 * Math.sin(t * 0.9 + i) };
              // Halloween: bats instead of gulls, flapping about twice as fast.
              return season.id === "halloween" ? (
                <Bat key={i} {...at} flap={Math.sin(t * Math.PI * 2 * (1.4 + i * 0.12) * 2.2)} size={(1 - i * 0.12) * scale * 1.3} />
              ) : (
                <Gull key={i} {...at} flap={Math.sin(t * Math.PI * 2 * (1.4 + i * 0.12))} size={(1 - i * 0.12) * scale} />
              );
            })}

            {/* The surface, then each deeper band */}
            <path d={band(w, h, surf.base, surf.amp, surf.period, surf.phase)} fill="var(--sea-foam)" />
            <path d={band(w, h, swell.base, swell.amp, swell.period, swell.phase)} fill="var(--sea-0)" />
            {/* The first section sits in the swell; each one after it starts with its own wave. */}
            {tops.slice(1).map((top, i) => (
              <path key={i} d={band(w, h, top + WAVE_INSET, 12 - Math.min(i, 4), 300 + (i % 4) * 40, (i % 2 ? -1 : 1) * ph * (0.4 + (i % 4) * 0.1))} fill={BANDS[Math.min(i, BANDS.length - 1)]} />
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
