"use client";
/**
 * LightLab's lamps drawn in fine line for beside the hero, traced from the
 * owner's own outlines (mushroom, banana, cloud). The pen draws each stroke in
 * turn, the lamp is named, then the lines erase in the same order. Everything
 * is worked out from the place in the loop, so the last frame matches the
 * first and nothing snaps. Black or white line (follows the theme); the pen
 * tip and name in the logo blue.
 */
import { useAnimationFrame, useReducedMotion } from "framer-motion";
import { useState } from "react";

const BLUE = "#297f9d";
const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 → 1 across [a, b]. */
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out = (t: number) => 1 - Math.pow(1 - t, 3);
/** A dot pops in with a little overshoot. */
const pop = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));

import { LAMPS, type Lamp, type LampId, type Stroke } from "./lamp-lines";

export { LAMPS, type LampId };

/** Where the drawings sit in the 320 × 400 frame (the name goes underneath). */
const AREA = { x: 24, y: 24, w: 272, h: 300 };
/** How much ink a dot counts for, so the pen pauses on it like a short stroke. */
const DOT_INK = 16;

/** Seconds per lamp. Slow on purpose. */
const PER_LAMP = 9;

// Path lengths and points, measured once in a hidden SVG.
let measurer: SVGSVGElement | null = null;
const measured = new Map<string, SVGPathElement>();
function measure(d: string) {
  if (typeof document === "undefined") return null;
  let p = measured.get(d);
  if (!p) {
    if (!measurer) {
      measurer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      measurer.setAttribute("aria-hidden", "true");
      measurer.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none";
      document.body.appendChild(measurer);
    }
    p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    measurer.appendChild(p);
    measured.set(d, p);
  }
  return p;
}
const inkOf = (s: Stroke) => ("dot" in s ? DOT_INK : (measure(s.d)?.getTotalLength() ?? 100));

/** Where we are in a loop of `seconds`, 0 to 1. Null for reduced motion. */
function useLoop(seconds: number) {
  const still = useReducedMotion();
  const [p, setP] = useState(0);
  useAnimationFrame((t) => {
    if (!still) setP(((t / 1000) % seconds) / seconds);
  });
  return still ? null : p;
}

/**
 * LightLab's lamps in line. With `only`, that lamp loops on its own; otherwise
 * they take turns. `tone="blue"` draws the line itself in the logo blue.
 */
export function OneLineLamps({ only, tone = "line" }: { only?: LampId; tone?: "line" | "blue" }) {
  const lamps = only ? LAMPS.filter((l) => l.id === only) : LAMPS;
  const p = useLoop(PER_LAMP * lamps.length);
  // Reduced motion: the first lamp, drawn, still.
  const k = p == null ? 0.65 : p * lamps.length;
  const lamp = lamps[Math.floor(k) % lamps.length];
  return <LampFrame key={lamp.id} lamp={lamp} t={k - Math.floor(k)} tone={tone} />;
}

/** One lamp at a moment t (0 → 1) of its turn. */
function LampFrame({ lamp, t, tone }: { lamp: Lamp; t: number; tone: "line" | "blue" }) {
  const [bx, by, bw, bh] = lamp.box;
  const scale = Math.min(AREA.w / bw, AREA.h / bh);
  const ox = AREA.x + (AREA.w - bw * scale) / 2 - bx * scale;
  const oy = AREA.y + (AREA.h - bh * scale) / 2 - by * scale;
  // Same line weight on screen whatever the drawing's size.
  const width = 1.7 / scale;

  const inks = lamp.strokes.map(inkOf);
  const total = inks.reduce((a, b) => a + b, 0);
  const drawn = inOut(seg(t, 0.03, 0.56)) * total;
  const erased = inOut(seg(t, 0.8, 0.97)) * total;
  const named = out(seg(t, 0.56, 0.68)) * (1 - inOut(seg(t, 0.76, 0.88)));
  const stroke = tone === "blue" ? BLUE : "currentColor";

  let start = 0;
  let tip: DOMPoint | { x: number; y: number } | null = null;
  const parts: React.ReactNode[] = [];
  for (let i = 0; i < lamp.strokes.length; i++) {
    const s = lamp.strokes[i];
    const len = inks[i];
    const shown = clamp((drawn - start) / len);
    const gone = clamp((erased - start) / len);
    start += len;
    if (!tip && shown > 0 && shown < 1 && t < 0.56) {
      tip = "dot" in s ? { x: s.dot[0], y: s.dot[1] } : (measure(s.d)?.getPointAtLength(len * shown) ?? null);
    }
    if ("dot" in s) {
      const [cx, cy, r] = s.dot;
      const size = pop(shown) * (1 - out(gone));
      if (size > 0) parts.push(<circle key={i} cx={cx} cy={cy} r={r * size} fill={stroke} />);
      continue;
    }
    // Draws in from its start, then erases from its start.
    const offset = gone > 0 ? -gone : 1 - shown;
    if (offset > -1 && offset < 1) parts.push(<path key={i} d={s.d} pathLength={1} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={offset} />);
  }
  const penFade = Math.min(seg(t, 0.03, 0.06), 1 - seg(t, 0.5, 0.56));

  return (
    <svg viewBox="0 0 320 400" className="h-full w-full overflow-visible text-fg" role="img" aria-label={`${lamp.name}, a LightLab lamp, drawn in line`}>
      <g transform={`translate(${ox} ${oy}) scale(${scale})`}>
        {parts}
        {tip && <circle cx={tip.x} cy={tip.y} r={3.2 / scale} fill={BLUE} opacity={penFade} />}
      </g>
      <text x="160" y="374" textAnchor="middle" className="ll-accent" style={{ fontSize: 30 }} fill={BLUE} opacity={named} transform={`translate(0 ${(1 - named) * 6})`}>
        {lamp.name}
      </text>
    </svg>
  );
}
