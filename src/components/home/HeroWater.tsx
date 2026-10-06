"use client";
/**
 * Hero background: slow waves across the full width, faint so the headline
 * reads on top, with a 3DBenchy bobbing on the right and seagulls flying by.
 * Drawn in pixel space (no stretching) and paused off screen. It runs on
 * continuous time, so nothing ever jumps back to a start position. Reduced
 * motion shows one still frame. Also used, shorter, behind the order upload step.
 */
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Benchy, Gull } from "@/components/brand/Benchy";

const NAVY = "#0e4471";
const SAND = "#e9c46a";
const LIGHT = "#86bbea";
const MID = "#3d7bb8";
/** Seconds for a gull to cross; each flaps at its own rate (beats per second). */
const CROSS_S = 18;
const gulls = [
  { y: 0.12, offset: 0, beats: 1.45, size: 1 },
  { y: 0.2, offset: 0.06, beats: 1.65, size: 0.8 },
  { y: 0.16, offset: 0.45, beats: 1.55, size: 0.9 },
];

type Props = {
  /** Water line as a fraction of the height, on wide screens and on phones. */
  surface?: { wide: number; narrow: number };
  /** Where the Benchy floats, as a fraction of the width. */
  boatAt?: { wide: number; narrow: number };
  boatSize?: number;
  sun?: boolean;
  /** Where the sun sits, as fractions of the width and height (overrides the default spots). */
  sunAt?: { x: number; y: number };
  birds?: boolean;
  /** Sail the Benchy in from the left edge when the scene appears. */
  enter?: boolean;
  /** How long the sail-in takes, in seconds (defaults to the order page's 6). */
  enterSeconds?: number;
  /**
   * Called every frame while the Benchy sails in: how far it still is from its
   * parking spot (px, negative while arriving), where its stern is on screen,
   * and progress from 0 to 1. The order page uses it to tow the upload box.
   */
  onTow?: (tow: Tow) => void;
};

export type Tow = { dx: number; sternX: number; sternY: number; p: number };

/** Fired by the home page "Start an order" button: the Benchy speeds off to the right. */
export const SAIL_EVENT = "benchy:sail";
/** Seconds for the Benchy to glide in on the order page. */
const ENTER_S = 6;
/** Moving straight away, then slowing gently as it arrives. */
const glide = (p: number) => 1 - Math.pow(1 - p, 2.4);
const START_TIME = 5;

function waveY(x: number, base: number, amp: number, period: number, phase: number) {
  return base + amp * Math.sin(((x + phase) / period) * Math.PI * 2);
}

function band(w: number, h: number, base: number, amp: number, period: number, phase: number) {
  let d = `M0 ${h} L0 ${waveY(0, base, amp, period, phase).toFixed(1)}`;
  for (let x = 10; x <= w + 10; x += 10) d += ` L${x} ${waveY(x, base, amp, period, phase).toFixed(1)}`;
  return `${d} L${w + 10} ${h} Z`;
}

export function HeroWater({
  surface: surfaceAt = { wide: 0.56, narrow: 0.74 },
  boatAt = { wide: 0.8, narrow: 0.7 },
  boatSize = 1,
  sun: showSun = true,
  sunAt,
  birds = true,
  enter = false,
  enterSeconds = ENTER_S,
  onTow,
}: Props = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Seconds since the scene started.
  const [time, setTime] = useState(START_TIME);
  const timeRef = useRef(START_TIME);
  const [sailAt, setSailAt] = useState<number | null>(null);
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
      timeRef.current = START_TIME + (now - start) / 1000;
      setTime(timeRef.current);
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

  useEffect(() => {
    const go = () => setSailAt(timeRef.current);
    window.addEventListener(SAIL_EVENT, go);
    return () => window.removeEventListener(SAIL_EVENT, go);
  }, []);

  const { w, h } = size;
  const wide = w >= 1024;
  // Water line: behind the buttons on wide screens, below them on phones.
  const surface = h * (wide ? surfaceAt.wide : surfaceAt.narrow);
  // Wave drift in pixels. Never wraps, so the water never resets.
  const ph = time * 44;
  const back = { base: surface, amp: 10, period: 260, phase: ph * 0.6 };
  const mid = { base: surface + h * 0.07, amp: 13, period: 300, phase: -ph };
  const front = {
    base: surface + h * 0.15,
    amp: 10,
    period: 220,
    phase: ph * 1.3,
  };

  const scale = Math.max(0.65, Math.min(1.15, w / 1200));
  const float = (x: number) => {
    const y = waveY(x, mid.base, mid.amp, mid.period, mid.phase);
    const slope = (waveY(x + 4, mid.base, mid.amp, mid.period, mid.phase) - y) / 4;
    return { x, y, rot: (Math.atan(slope) * 180) / Math.PI };
  };
  // Where the Benchy is: parked, sailing in from the left, or speeding off right.
  const parkedX = w * (wide ? boatAt.wide : boatAt.narrow);
  let boatX = parkedX;
  let lean = 0;
  // While sailing in it starts just past the left edge, so it's in view
  // straight away; the towed box trails behind it, off screen at first.
  const enterP = enter && !reduce ? Math.min(1, (time - START_TIME) / enterSeconds) : 1;
  if (enterP < 1) {
    const from = -160;
    boatX = from + (parkedX - from) * glide(enterP);
    lean = -2.5 * Math.sin(Math.PI * enterP);
  }
  if (sailAt != null) {
    // Speeds off past the right edge.
    const d = Math.max(0, time - sailAt);
    boatX += 60 * d + 600 * d * d;
    lean = -Math.min(6, d * 14);
  }
  const boat = float(boatX);
  const boatScale = scale * (wide ? 1.36 : 1.06) * boatSize;
  const sternX = boat.x - 70 * boatScale;
  const sternY = boat.y - 22 * boatScale;
  const towDone = useRef(false);
  useEffect(() => {
    if (!onTow || !enter || towDone.current || !w) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    onTow({ dx: boatX - parkedX, sternX: rect.left + sternX, sternY: rect.top + sternY, p: enterP });
    if (enterP >= 1) towDone.current = true;
  });

  // On phones the sun sits low on the horizon, clear of the buttons.
  const sun = sunAt ? { x: w * sunAt.x, y: h * sunAt.y } : wide ? { x: w * 0.84, y: h * 0.2 } : { x: w * 0.84, y: surface - 6 };

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      {w > 0 && (
        <svg width={w} height={h} className="block">
          {showSun && <circle cx={sun.x} cy={sun.y} r={34 * scale} fill={SAND} className="opacity-90" />}
          {birds &&
            gulls.map((g, i) => {
              // Each gull wraps round off screen, so the crossing looks endless.
              const k = (time / CROSS_S + g.offset) % 1;
              const x = -60 + k * (w + 120);
              const y = h * g.y + 8 * Math.sin((time / CROSS_S) * Math.PI * 4 + i);
              const flap = Math.sin(time * Math.PI * 2 * g.beats);
              return <Gull key={i} x={x} y={y} flap={flap} size={g.size * scale} />;
            })}
          {/* Faint water: low opacity so text on top stays easy to read. */}
          <g className="opacity-[0.22] light:opacity-[0.16]">
            <path d={band(w, h, back.base, back.amp, back.period, back.phase)} fill={LIGHT} />
            <path d={band(w, h, mid.base, mid.amp, mid.period, mid.phase)} fill={MID} />
          </g>
          <g transform={`translate(${boat.x} ${boat.y}) rotate(${boat.rot * 0.8 + lean}) scale(${boatScale})`}>
            <Benchy time={time} />
          </g>
          <path d={band(w, h, front.base, front.amp, front.period, front.phase)} fill={NAVY} className="opacity-[0.35] light:opacity-[0.2]" />
          {/* Wavy bottom edge, in the page colour, so the water doesn't end in a straight line. */}
          <path d={band(w, h, h - 18, 7, 340, -ph * 0.5)} fill="var(--bg)" />
        </svg>
      )}
    </div>
  );
}
