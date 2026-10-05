"use client";
/**
 * Hero background: slow waves across the full width, faint so the headline
 * reads on top, with a 3DBenchy bobbing on the right and seagulls flying by.
 * Drawn in pixel space (no stretching) and paused off screen. Reduced motion
 * shows one still frame.
 */
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const NAVY = "#0e4471";
const SAND = "#e9c46a";
const LIGHT = "#86bbea";
const MID = "#3d7bb8";
const PALE = "#dfe8f1";
// Benchy in the brand blues.
const HULL = "#3d7bb8";
const HULL_DARK = "#0e4471";
const CABIN = "#86bbea";
const CABIN_DARK = "#4f91cc";
/** Everything repeats every LOOP_MS; waves, wing beats and gull crossings are whole cycles of it. */
const LOOP_MS = 18000;

const gulls = [
  { y: 0.12, offset: 0, beats: 26, size: 1 },
  { y: 0.2, offset: 0.06, beats: 30, size: 0.8 },
  { y: 0.16, offset: 0.45, beats: 28, size: 0.9 },
];

function waveY(x: number, base: number, amp: number, period: number, phase: number) {
  return base + amp * Math.sin(((x + phase) / period) * Math.PI * 2);
}

function band(w: number, h: number, base: number, amp: number, period: number, phase: number) {
  let d = `M0 ${h} L0 ${waveY(0, base, amp, period, phase).toFixed(1)}`;
  for (let x = 10; x <= w + 10; x += 10) d += ` L${x} ${waveY(x, base, amp, period, phase).toFixed(1)}`;
  return `${d} L${w + 10} ${h} Z`;
}

export function HeroWater() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [t, setT] = useState(0.3);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (reduce || !el) return;
    let raf = 0;
    let on = true;
    const start = performance.now();
    const tick = (now: number) => {
      setT(((now - start) % LOOP_MS) / LOOP_MS);
      if (on) raf = requestAnimationFrame(tick);
    };
    // Only animate while the hero is on screen.
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      on = e.isIntersecting;
      if (on) raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      on = false;
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [reduce]);

  const { w, h } = size;
  const wide = w >= 1024;
  // Water line: behind the buttons on wide screens, below them on phones.
  const surface = h * (wide ? 0.56 : 0.74);
  const ph = t * 800;
  const back = { base: surface, amp: 10, period: 260, phase: ph * 0.6 };
  const mid = { base: surface + h * 0.07, amp: 13, period: 300, phase: -ph };
  const front = { base: surface + h * 0.15, amp: 10, period: 220, phase: ph * 1.3 };

  const scale = Math.max(0.65, Math.min(1.15, w / 1200));
  const float = (x: number) => {
    const y = waveY(x, mid.base, mid.amp, mid.period, mid.phase);
    const slope = (waveY(x + 4, mid.base, mid.amp, mid.period, mid.phase) - y) / 4;
    return { x, y, rot: (Math.atan(slope) * 180) / Math.PI };
  };
  const boat = float(w * (wide ? 0.8 : 0.7));
  const boatScale = scale * (wide ? 1.36 : 1.06);
  // On phones the sun sits low on the horizon, clear of the buttons.
  const sun = wide ? { x: w * 0.84, y: h * 0.2 } : { x: w * 0.84, y: surface - 6 };

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      {w > 0 && (
        <svg width={w} height={h} className="block">
          <circle cx={sun.x} cy={sun.y} r={34 * scale} fill={SAND} className="opacity-90" />
          {gulls.map((g, i) => {
            const k = (t + g.offset) % 1;
            const x = -60 + k * (w + 120);
            const y = h * g.y + 8 * Math.sin(k * Math.PI * 4 + i);
            const flap = Math.sin(t * Math.PI * 2 * g.beats);
            return <Gull key={i} x={x} y={y} flap={flap} size={g.size * scale} />;
          })}
          {/* Faint water: low opacity so text on top stays easy to read. */}
          <g className="opacity-[0.22] light:opacity-[0.16]">
            <path d={band(w, h, back.base, back.amp, back.period, back.phase)} fill={LIGHT} />
            <path d={band(w, h, mid.base, mid.amp, mid.period, mid.phase)} fill={MID} />
          </g>
          <g transform={`translate(${boat.x} ${boat.y}) rotate(${boat.rot * 0.8}) scale(${boatScale})`}>
            <Benchy t={t} />
          </g>
          <path d={band(w, h, front.base, front.amp, front.period, front.phase)} fill={NAVY} className="opacity-[0.35] light:opacity-[0.2]" />
          {/* Wavy bottom edge, in the page colour, so the water doesn't end in a straight line. */}
          <path d={band(w, h, h - 18, 7, 340, -ph * 0.5)} fill="var(--bg)" />
        </svg>
      )}
    </div>
  );
}

/** A seagull: two curved wings that beat up and down. flap runs from -1 to 1. */
function Gull({ x, y, flap, size }: { x: number; y: number; flap: number; size: number }) {
  const tip = -10 * flap;
  const mid = -12 - 4 * flap;
  return (
    <path
      transform={`translate(${x} ${y}) scale(${size})`}
      d={`M-18 ${tip} Q-9 ${mid} 0 0 Q9 ${mid} 18 ${tip}`}
      fill="none"
      stroke="var(--muted)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/**
 * A friendly, rounded take on the 3DBenchy test print in the brand blues:
 * blue hull, light blue cabin with the arched doorway, a porthole and a chimney puffing smoke.
 * Bow faces right; the waterline is y = 0.
 */
function Benchy({ t }: { t: number }) {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {/* Smoke puffs drift up from the chimney */}
      {[0, 1, 2].map((i) => {
        const k = (t * 12 + i / 3) % 1;
        return <circle key={i} cx={-14 + k * 10} cy={-122 - k * 34} r={4 + k * 7} fill={PALE} opacity={0.8 * (1 - k)} />;
      })}
      {/* Chimney */}
      <rect x="-22" y="-124" width="16" height="30" rx="5" fill={CABIN} />
      <rect x="-25" y="-128" width="22" height="9" rx="4.5" fill={CABIN_DARK} />
      {/* Cabin */}
      <path d="M-30 -32 V-90 Q-30 -96 -24 -96 H24 Q30 -96 30 -90 V-40 Z" fill={CABIN} />
      <rect x="-36" y="-104" width="74" height="12" rx="6" fill={CABIN} />
      <path d="M-12 -36 V-66 A12 12 0 0 1 12 -66 V-39 Z" fill={CABIN_DARK} />
      {/* Stern box */}
      <rect x="-64" y="-36" width="18" height="12" rx="4" fill={CABIN} />
      {/* Hull */}
      <path d="M-70 -24 Q-10 -26 46 -46 Q66 -52 70 -42 Q66 -10 36 4 Q18 10 -40 10 Q-66 10 -70 -6 Z" fill={HULL} />
      <path d="M-70 -6 Q-66 10 -40 10 Q18 10 36 4 Q50 -3 58 -12 Q20 2 -40 2 Q-60 2 -70 -6 Z" fill={HULL_DARK} />
      {/* Light blue deck rail along the top of the hull */}
      <path d="M-72 -25 Q-10 -27 46 -47 Q64 -53 70 -44" fill="none" stroke={CABIN} strokeWidth="7" />
      {/* Porthole */}
      <circle cx="44" cy="-28" r="7.5" fill={SAND} stroke={CABIN} strokeWidth="3.5" />
      <circle cx="42" cy="-30" r="2" fill="#ffffff" opacity="0.8" />
    </g>
  );
}
