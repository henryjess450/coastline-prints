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

export type LampId = "mushroom" | "banana" | "cloud";

/** A line the pen draws, or a dot it taps (the cloud's eyes). */
type Stroke = { d: string } | { dot: [number, number, number] };
type Lamp = { id: LampId; name: string; strokes: Stroke[]; /** The drawing's bounds in its own units. */ box: [number, number, number, number] };

/** An ellipse as a path, starting and ending on its left edge. */
const ellipse = ([cx, cy, rx, ry]: number[]) => `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

// Mushroom spots, in the order the pen visits them (top to bottom, sweeping across).
const SPOTS = [[85, 57, 5, 8], [110, 55, 6, 8], [96, 78, 7, 7], [68, 88, 7, 10], [122, 82, 7, 10], [103, 110, 12, 12], [55, 120, 12, 12], [138, 118, 12, 14], [32, 148, 8, 6], [92, 140, 10, 10], [118, 147, 10, 10], [65, 155, 10, 10], [170, 140, 9, 6], [155, 155, 11, 10], [195, 152, 8, 5], [98, 168, 10, 10], [40, 177, 9, 9], [12, 187, 10, 8], [130, 173, 10, 10], [67, 187, 13, 9], [182, 170, 10, 10], [214, 175, 7, 5], [6, 209, 4, 3], [33, 205, 12, 7], [105, 198, 12, 8], [160, 190, 10, 10], [213, 190, 6, 5], [77, 213, 12, 8], [138, 205, 9, 9], [55, 220, 6, 4], [190, 200, 8, 6], [178, 208, 6, 4], [118, 220, 9, 6]];

export const LAMPS: Lamp[] = [
  {
    id: "mushroom",
    name: "Fun-gi",
    box: [-50, 22, 300, 394],
    strokes: [
      { d: "M-35 220 C-48 200 -40 170 -10 150 C20 130 40 115 48 90 C58 55 75 28 100 27 C125 28 140 50 150 85 C158 112 180 130 210 148 C238 166 248 192 240 212 C236 222 230 226 222 228 C160 244 30 242 -35 220 Z" },
      ...SPOTS.map((s) => ({ d: ellipse(s) })),
      { d: "M80 244 C70 292 40 322 40 362 C40 394 66 412 100 412 C134 412 170 394 170 362 C170 322 142 292 134 244" },
    ],
  },
  {
    id: "banana",
    name: "Banana After Dark",
    box: [0, 6, 284, 274],
    strokes: [
      // Bulb, the peel arching down to the table and back, the fruit, the flap: one line.
      { d: "M80 67 C78 40 92 12 118 10 C142 8 160 28 156 50 C154 62 146 74 140 84 C136 92 134 100 133 118 C140 100 152 88 172 82 C196 76 216 90 222 120 C228 160 228 200 238 225 C248 245 266 252 278 262 C282 268 274 272 266 272 C252 262 236 240 226 215 C214 180 214 140 206 120 C198 104 178 100 162 112 C152 122 152 140 150 150 C146 175 140 195 133 205 C118 232 100 250 60 258 C40 262 20 262 6 260 C0 256 2 248 10 240 C18 228 26 214 32 200 L43 184 C55 185 66 186 75 184 C74 160 76 120 82 100 C88 84 94 70 100 62 C88 64 82 70 76 70 C64 66 56 58 44 60 C26 70 18 110 20 140 C21 152 22 158 24 163 L32 200" },
      { d: "M8 264 C12 274 44 278 80 272 C108 266 124 248 134 222" },
      { d: "M113 227 C96 250 60 262 14 266" },
      // The filament
      { d: "M104 57 L103 42 L110 50 L116 44 L121 50 L127 44 L127 55" },
    ],
  },
  {
    id: "cloud",
    name: "Cloudy",
    box: [14, 10, 220, 140],
    strokes: [
      { d: "M62 148 C30 148 16 125 17 100 C18 70 40 44 70 41 C80 22 104 12 125 12 C146 12 162 22 172 34 C202 36 224 56 220 90 C232 100 234 118 230 128 C226 142 216 148 200 148 Z" },
      { d: "M60 135 C42 135 31 120 31 100 C31 76 52 56 76 53 C86 34 104 23 125 23 C143 23 158 33 165 47 C190 46 212 64 206 95 C216 102 222 112 220 122 C218 130 212 135 204 135 Z" },
      { dot: [97, 80, 5.5] },
      { dot: [156, 80, 5.5] },
      { d: "M118 98 C118 110 136 110 136 98" },
    ],
  },
];

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
