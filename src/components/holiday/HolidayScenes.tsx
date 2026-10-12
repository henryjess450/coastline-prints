"use client";
/**
 * The holiday gift card scenes, drawn in a 600 × 360 space (like the
 * send-off) with flat, solid colours:
 *   DeliveryStreet  a delivery truck drives up a snowy street to a house and drops the present at the door
 *   LivingRoom      the tree with twinkling lights, the family on the couch, and the present arriving under the tree
 *   HolidayFinale   both in a row, as the ending of the gift card send-off
 * Everything that repeats (snow, lights, breathing) loops back to where it started.
 */
import { AnimatePresence, cubicBezier, easeIn, easeInOut, easeOut, motion, type Easing, type EasingFunction, type Transition } from "framer-motion";
import { useEffect, useState } from "react";
import { GOLD, GOLD_DARK, RED, RED_DARK, RED_LIGHT } from "@/components/sendoff/SendOff";

const NIGHT = "#10233a";
const SNOW = "#eef3f8";
const SNOW_SHADE = "#c9d6e3";
const PINE = ["#1d6b3c", "#22804a", "#2c9656"];
const BULBS = ["#ff5a4e", "#e9c46a", "#7cc4f0", "#7bd88f", "#f59ad1"];

/** Same numbers every render, so the scene never jumps. */
function seeded(n: number, seed: number) {
  let s = seed;
  return Array.from({ length: n }, () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  });
}

/**
 * The looping bits (snow, twinkles) are CSS animations: a negative delay starts
 * each one part-way through its loop, so nothing jumps when the scene appears,
 * and every loop ends exactly where it began.
 */
export function HolidayStyles() {
  return (
    <style>{`
      @keyframes cp-snow { from { transform: translate(0, 0); } to { transform: translate(var(--dx), var(--dy)); } }
      @keyframes cp-twinkle { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
      .cp-snow { animation: cp-snow var(--t) linear var(--d) infinite; }
      .cp-twinkle { animation: cp-twinkle var(--t) ease-in-out var(--d) infinite; }
      @media (prefers-reduced-motion: reduce) { .cp-snow, .cp-twinkle { animation: none; } }
    `}</style>
  );
}

const vars = (v: Record<string, string | number>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [`--${k}`, typeof x === "number" ? `${x}s` : x])) as React.CSSProperties;

/** Snow falling across the given box; each flake falls past the bottom and starts again above the top, out of sight. */
export function Snow({ x = -200, y = -40, w = 1000, h = 440, count = 46, seed = 7, opacity = 0.9, size = 1 }: { x?: number; y?: number; w?: number; h?: number; count?: number; seed?: number; opacity?: number; /** Flake size multiplier. */ size?: number }) {
  const r = seeded(count * 4, seed);
  return (
    <g opacity={opacity} aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const dur = 5 + r[i * 4 + 2] * 5;
        return (
          <circle
            key={i}
            className="cp-snow"
            cx={x + r[i * 4] * w}
            cy={y}
            r={(1.2 + r[i * 4 + 1] * 2.2) * size}
            fill="#fff"
            style={vars({ t: dur, d: -r[i * 4 + 3] * dur, dx: `${((r[i * 4 + 3] - 0.5) * 30).toFixed(1)}px`, dy: `${h}px` })}
          />
        );
      })}
    </g>
  );
}

/** A bulb that glows up and down, ending each loop where it began. */
function Bulb({ cx, cy, color, i }: { cx: number; cy: number; color: string; i: number }) {
  const t = 1.4 + (i % 4) * 0.35;
  return <circle className="cp-twinkle" cx={cx} cy={cy} r="4.2" fill={color} style={vars({ t, d: -((i * 0.37) % t) })} />;
}

/** The tree, star and string of lights. Its base sits at (cx, base). */
export function ChristmasTree({ cx = 430, base = 286, scale = 1 }: { cx?: number; base?: number; scale?: number }) {
  // Lights follow three gentle swags down the tree.
  const lights: [number, number][] = [];
  [
    { y: 140, w: 34 },
    { y: 186, w: 56 },
    { y: 232, w: 78 },
  ].forEach(({ y, w }) => {
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      lights.push([-w + t * 2 * w, y - 14 + Math.sin(t * Math.PI) * 14]);
    }
  });
  return (
    <g transform={`translate(${cx} ${base}) scale(${scale}) translate(0 ${-base})`}>
      <rect x="-9" y={base - 26} width="18" height="26" rx="2" fill="#6b4226" />
      <path d={`M0 ${base - 190}L-60 ${base - 110}H60Z`} fill={PINE[2]} />
      <path d={`M0 ${base - 150}L-82 ${base - 62}H82Z`} fill={PINE[1]} />
      <path d={`M0 ${base - 110}L-102 ${base - 20}H102Z`} fill={PINE[0]} />
      {/* Light string */}
      {[140, 186, 232].map((y, i) => {
        const w = [34, 56, 78][i];
        return <path key={y} d={`M${-w} ${y - 14 + (base - 286)} Q0 ${y + 14 + (base - 286)} ${w} ${y - 14 + (base - 286)}`} stroke="#0d3a20" strokeWidth="1.5" fill="none" />;
      })}
      {lights.map(([x, y], i) => (
        <Bulb key={i} cx={x} cy={y + (base - 286)} color={BULBS[i % BULBS.length]} i={i} />
      ))}
      {/* Star on top, with a slow sparkle */}
      <motion.path
        d={`M0 ${base - 210}l6 13 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2z`}
        fill={GOLD}
        stroke={GOLD_DARK}
        strokeWidth="1.5"
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        // SVG shapes transform around their own box: spin and scale from the middle.
        style={{ originX: "50%", originY: "50%" }}
      />
    </g>
  );
}

/** A small wrapped present (already under the tree). */
function SmallGift({ x, y, w, h, box, ribbon }: { x: number; y: number; w: number; h: number; box: string; ribbon: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2" fill={box} />
      <rect x={x + w / 2 - 2.5} y={y} width="5" height={h} fill={ribbon} />
      <rect x={x - 2} y={y - 5} width={w + 4} height="7" rx="2" fill={box} />
      <rect x={x + w / 2 - 2.5} y={y - 5} width="5" height="7" fill={ribbon} />
    </g>
  );
}

/** The present that's being delivered: red with a gold ribbon and bow, like the send-off box. Drawn around (0, 0), bottom at y = 0. */
export function Present({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <rect x="-20" y="-28" width="40" height="28" rx="3" fill={RED} />
      <rect x="-3.5" y="-28" width="7" height="28" fill={GOLD} />
      <rect x="-23" y="-35" width="46" height="9" rx="3" fill={RED_LIGHT} />
      <rect x="-3.5" y="-35" width="7" height="9" fill={GOLD} />
      <ellipse cx="-7" cy="-40" rx="8" ry="5" fill={GOLD} transform="rotate(-22 -7 -40)" />
      <ellipse cx="7" cy="-40" rx="8" ry="5" fill={GOLD} transform="rotate(22 7 -40)" />
      <circle cx="0" cy="-38" r="3.5" fill={GOLD_DARK} />
    </g>
  );
}

/**
 * The scenes run on clocks: each moving part gets [second, value] keyframes
 * on the same timeline (the street's STREET_S, or the room's ROOM_S), so
 * everything stays in step, eases smoothly, and ends where it should.
 */
type Anim = { values: number[]; t: Transition };
/**
 * Named and bezier eases become functions: framer-motion then runs every
 * keyframe itself (fades included, which it would otherwise hand to the
 * browser), so the whole scene stays on one clock, even when recorded.
 */
const NAMED: Record<string, EasingFunction> = { linear: (v) => v, easeIn, easeOut, easeInOut };
const asFn = (e: Easing): EasingFunction => (typeof e === "function" ? e : Array.isArray(e) ? cubicBezier(e[0], e[1], e[2], e[3]) : (NAMED[e as string] ?? easeInOut));
function track<V>(points: [number, V][], ease: Easing | Easing[] = "easeInOut", duration = STREET_S): { values: V[]; t: Transition } {
  const fn = Array.isArray(ease) && typeof ease[0] !== "number" ? (ease as Easing[]).map(asFn) : asFn(ease as Easing);
  return { values: points.map((p) => p[1]), t: { duration, times: points.map((p) => p[0] / duration), ease: fn } };
}
/** Alternating values every `step` seconds from `from` to `to`, e.g. legs swinging while walking. */
function swing(from: number, to: number, step: number, a: number, b: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let t = from, k = 0; t < to - 0.001; t += step, k++) pts.push([+t.toFixed(3), k % 2 ? b : a]);
  return pts;
}
/** The same keyframes with every value passed through `f` (e.g. leg length from "how stood up"). */
const mapAnim = (a: Anim, f: (v: number) => number): Anim => ({ values: a.values.map(f), t: a.t });
const hold = (v: number): Anim => ({ values: [v, v], t: { duration: 0.01 } });

/** The room's clock: the present arrives, Dad brings it to the kid, the kid opens it. */
const ROOM_S = 9.6;
const room = <V,>(points: [number, V][], ease: Easing | Easing[] = "easeInOut") => track(points, ease, ROOM_S);

/**
 * One of the family, front view, feet on the floor at x. Sitting is `rise` 0
 * (lap and dangling legs), standing is 1. Arms and legs swing from the
 * shoulder and hip like the driver's. `children` are held at the chest.
 */
function Member({
  x,
  scale = 1,
  skin,
  hair,
  jumper,
  pants,
  rise = hold(0),
  lean = hold(0),
  hop = hold(0),
  legL = hold(0),
  legR = hold(0),
  armL = hold(-12),
  armR = hold(12),
  children,
}: {
  x: Anim;
  scale?: number;
  skin: string;
  hair: string;
  jumper: string;
  pants: string;
  rise?: Anim;
  lean?: Anim;
  hop?: Anim;
  legL?: Anim;
  legR?: Anim;
  armL?: Anim;
  armR?: Anim;
  children?: React.ReactNode;
}) {
  // Sitting folds the legs to half height and lowers the body onto the seat; the lap shows.
  const legLength = mapAnim(rise, (r) => 0.5 + 0.5 * r);
  const seat = mapAnim(rise, (r) => 14 * (1 - r));
  const lap = mapAnim(rise, (r) => 1 - r);
  const leg = (anim: Anim, lx: number) => (
    <motion.g initial={false} animate={{ rotate: anim.values }} transition={{ rotate: anim.t }} style={{ originX: "50%", originY: "0%" }}>
      <rect x={lx} y="-52" width="7.5" height="50" rx="3.5" fill={pants} />
      <rect x={lx - 1} y="-5" width="9.5" height="5" rx="2.5" fill="#2a1a12" />
    </motion.g>
  );
  const arm = (anim: Anim, ax: number) => (
    <motion.g initial={false} animate={{ rotate: anim.values }} transition={{ rotate: anim.t }} style={{ originX: "50%", originY: "0%" }}>
      <rect x={ax - 3.25} y="-90" width="6.5" height="27" rx="3.25" fill={jumper} />
      {/* A touch darker than the jumper, so arms read in front of it */}
      <rect x={ax - 3.25} y="-90" width="6.5" height="27" rx="3.25" fill="#000" opacity="0.18" />
      <circle cx={ax} cy="-62" r="3.6" fill={skin} />
    </motion.g>
  );
  return (
    <motion.g initial={false} animate={{ x: x.values, y: hop.values }} transition={{ x: x.t, y: hop.t }}>
      <g transform={`translate(0 292) scale(${scale})`}>
        <motion.g initial={false} animate={{ scaleY: legLength.values }} transition={{ scaleY: legLength.t }} style={{ originX: "50%", originY: "100%" }}>
          {leg(legL, -9.5)}
          {leg(legR, 2)}
        </motion.g>
        <motion.g initial={false} animate={{ y: seat.values, rotate: lean.values }} transition={{ y: seat.t, rotate: lean.t }} style={{ originX: "50%", originY: "100%" }}>
          {/* Lap (thighs coming toward us), only while sitting */}
          <motion.rect x="-12" y="-54" width="24" height="16" rx="7" fill={pants} initial={false} animate={{ opacity: lap.values }} transition={{ opacity: lap.t }} />
          {/* Jumper with a stripe, head, hair, face */}
          <path d="M-15 -52v-28a12 12 0 0 1 12-12h6a12 12 0 0 1 12 12v28z" fill={jumper} />
          <path d="M-9 -68h18" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
          <circle cx="0" cy="-104" r="12" fill={skin} />
          <path d="M-12 -106a12 12 0 0 1 24 0c-4-6-9-7.5-12-7.5s-8 1.5-12 7.5z" fill={hair} />
          <path d="M-3.8 -100q3.8 3 7.6 0" stroke="#3a2418" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle cx="-4.2" cy="-105" r="1.3" fill="#3a2418" />
          <circle cx="4.2" cy="-105" r="1.3" fill="#3a2418" />
          {arm(armL, -15)}
          {arm(armR, 15)}
          {children}
        </motion.g>
      </g>
    </motion.g>
  );
}

/** The couch, drawn behind the family (they sit on its front edge, legs dangling). */
function Couch() {
  return (
    <g>
      <rect x="128" y="196" width="196" height="62" rx="14" fill="#2f6f7e" />
      <rect x="136" y="248" width="180" height="26" rx="8" fill="#3a8496" />
      <rect x="116" y="222" width="26" height="62" rx="10" fill="#2a6372" />
      <rect x="310" y="222" width="26" height="62" rx="10" fill="#2a6372" />
      <rect x="132" y="282" width="8" height="10" fill="#1e3b44" />
      <rect x="312" y="282" width="8" height="10" fill="#1e3b44" />
    </g>
  );
}

const MOM = { skin: "#f1c7a3", hair: "#6b3a1e", jumper: RED, pants: "#3b4a63" };
const KID = { skin: "#e0ac7e", hair: "#2a1a12", jumper: GOLD, pants: "#2f6f7e" };
const DAD = { skin: "#8d5a3b", hair: "#1b1210", jumper: "#2c9656", pants: "#26354d" };
const KID_SCALE = 0.78;

/** The delivered present, with a lid that can pop off. (x, y) is the middle of its bottom edge. */
function RoomPresent({ x, y, lid }: { x: Anim; y: Anim; lid: Anim }) {
  const lidY = mapAnim(lid, (v) => -34 * v);
  const lidX = mapAnim(lid, (v) => 22 * v);
  const lidTurn = mapAnim(lid, (v) => 40 * v);
  const lidShown = mapAnim(lid, (v) => (v < 0.6 ? 1 : 1 - (v - 0.6) / 0.4));
  return (
    <motion.g initial={false} animate={{ x: x.values, y: y.values }} transition={{ x: x.t, y: y.t }}>
      <g transform="scale(0.85)">
        <rect x="-20" y="-28" width="40" height="28" rx="3" fill={RED} />
        <rect x="-3.5" y="-28" width="7" height="28" fill={GOLD} />
        <motion.g initial={false} animate={{ x: lidX.values, y: lidY.values, rotate: lidTurn.values, opacity: lidShown.values }} transition={{ x: lidX.t, y: lidY.t, rotate: lidTurn.t, opacity: lidShown.t }} style={{ originX: "50%", originY: "50%" }}>
          <rect x="-23" y="-35" width="46" height="9" rx="3" fill={RED_LIGHT} />
          <rect x="-3.5" y="-35" width="7" height="9" fill={GOLD} />
          <ellipse cx="-7" cy="-40" rx="8" ry="5" fill={GOLD} transform="rotate(-22 -7 -40)" />
          <ellipse cx="7" cy="-40" rx="8" ry="5" fill={GOLD} transform="rotate(22 7 -40)" />
          <circle cx="0" cy="-38" r="3.5" fill={GOLD_DARK} />
        </motion.g>
      </g>
    </motion.g>
  );
}

/**
 * The family's story in the room, on the room's clock: the present slides
 * in under the tree; Dad gets up, walks over, picks it up, carries it to the
 * kid and sets it on their lap, then sits back down; the kid lifts the lid
 * and holds the gift card up high while Mom claps.
 */
function FamilyStory() {
  // Where Dad stands to pick it up, and to hand it over (just right of the kid).
  const BY_TREE = 414;
  const BY_KID = 256;
  const KID_X = 228;
  const step = 0.28;
  const dadX = room(
    [
      [0, 278],
      [2.75, 278],
      [3.85, BY_TREE],
      [4.75, BY_TREE],
      [5.85, BY_KID],
      [6.35, BY_KID],
      [6.85, 278],
      [ROOM_S, 278],
    ],
    ["linear", "linear", "linear", "linear", "linear", "easeInOut", "linear"],
  );
  const dadRise = room([
    [0, 0],
    [2.2, 0],
    [2.7, 1],
    [3.85, 1],
    [4.1, 0.62],
    [4.4, 0.62],
    [4.7, 1],
    [5.85, 1],
    [6.1, 0.85],
    [6.35, 1],
    [6.9, 1],
    [7.4, 0],
    [ROOM_S, 0],
  ]);
  const walking = (a: number, b: number): [number, number][] => [...swing(2.75, 3.85, step, a, b), [3.85, 0], [4.75, 0], ...swing(4.75, 5.85, step, a, b), [5.85, 0], [6.35, 0], ...swing(6.35, 6.85, step, a, b), [6.85, 0]];
  const dadLegL = room([[0, 0], ...walking(-18, 18), [ROOM_S, 0]]);
  const dadLegR = room([[0, 0], ...walking(18, -18), [ROOM_S, 0]]);
  const dadLean = room([
    [0, 0],
    [5.85, 0],
    [6.1, -14],
    [6.35, 0],
    [ROOM_S, 0],
  ]);
  const dadArmL = room([
    [0, -12],
    [2.7, -6],
    [3.85, -6],
    [4.1, -22],
    [4.4, -40],
    [6.1, -40],
    [6.4, -12],
    [ROOM_S, -12],
  ]);
  const dadArmR = room([
    [0, 12],
    [2.7, 6],
    [3.85, 6],
    [4.1, 22],
    [4.4, 40],
    [6.1, 40],
    [6.4, 12],
    [ROOM_S, 12],
  ]);
  // The present: slides in under the tree, up into Dad's hands, across the room, onto the kid's lap.
  const HELD = 239;
  const LAP = 266;
  const presentX = room(
    [
      [0, 20],
      [0.6, 20],
      [1.7, 440],
      [4.1, 440],
      [4.4, BY_TREE],
      [4.75, BY_TREE],
      [5.85, BY_KID],
      [6.1, KID_X + 6],
      [6.3, KID_X],
      [ROOM_S, KID_X],
    ],
    [[0.2, 0.8, 0.3, 1], [0.2, 0.8, 0.3, 1], "linear", "easeInOut", "linear", "linear", "easeInOut", "easeOut", "linear"],
  );
  const presentY = room([
    [0, 292],
    [4.1, 292],
    [4.45, HELD],
    [5.85, HELD],
    [6.3, LAP],
    [ROOM_S, LAP],
  ]);
  const lid = room([
    [0, 0],
    [6.9, 0],
    [7.35, 1],
    [ROOM_S, 1],
  ]);
  // The kid reaches for it, lifts the lid off, then holds the card up over their head and hops.
  // Raised arms swing outward and up (left arm clockwise, right arm the other way), ending straight up beside the head.
  const kidArmL = room([[0, -12], [6.3, -12], [6.6, -32], [7.2, -32], [7.85, 172], ...swing(8.1, 9.3, 0.3, 166, 178), [ROOM_S, 172]]);
  const kidArmR = room([[0, 12], [6.3, 12], [6.6, 32], [7.2, 32], [7.85, -172], ...swing(8.1, 9.3, 0.3, -166, -178), [ROOM_S, -172]]);
  const kidHop = room([
    [0, 0],
    [8.0, 0],
    [8.2, -9],
    [8.45, 0],
    [8.65, -5],
    [8.85, 0],
    [ROOM_S, 0],
  ]);
  const cardY = room([
    [0, LAP - 8],
    [7.2, LAP - 8],
    [7.85, 200],
    [8.0, 200],
    [8.2, 191],
    [8.45, 200],
    [8.65, 195],
    [8.85, 200],
    [ROOM_S, 200],
  ]);
  const cardShown = room([
    [0, 0],
    [7.15, 0],
    [7.3, 1],
    [ROOM_S, 1],
  ]);
  // Mom claps once the card is out.
  const momArmL = room([[0, -12], [7.9, -12], ...swing(8.0, 9.4, 0.18, -48, -22), [ROOM_S, -40]]);
  const momArmR = room([[0, 12], [7.9, 12], ...swing(8.0, 9.4, 0.18, 48, 22), [ROOM_S, 40]]);
  const sparkle = (at: number) =>
    room([
      [0, 0],
      [at, 0],
      [at + 0.25, 1],
      [at + 0.7, 0],
      [ROOM_S, 0],
    ]);
  const sparkles: [number, number, number][] = [
    [404, 236, 1.7],
    [480, 230, 1.82],
    [500, 266, 1.94],
    [204, 186, 7.9],
    [254, 182, 8.05],
    [200, 216, 8.2],
  ];
  return (
    <g>
      <Member x={hold(176)} {...MOM} armL={momArmL} armR={momArmR} />
      <Member x={hold(KID_X)} scale={KID_SCALE} {...KID} hop={kidHop} armL={kidArmL} armR={kidArmR} />
      {/* The gift card, rising out of the box and held up high */}
      <motion.g initial={false} animate={{ y: cardY.values, opacity: cardShown.values }} transition={{ y: cardY.t, opacity: cardShown.t }}>
        <g transform={`translate(${KID_X} 0)`}>
          <rect x="-15" y="-10" width="30" height="20" rx="3" fill="#a51d1d" />
          <path d="M-10 -1c2.5-2 5-2 7.5 0s5 2 7.5 0" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle cx="9" cy="-5" r="2.2" fill="#2f9a58" />
          <text x="12" y="7.5" textAnchor="end" fontSize="5.5" fontWeight="700" fill={GOLD} fontFamily="var(--font-geist-sans)">
            $55
          </text>
        </g>
      </motion.g>
      <Member x={dadX} {...DAD} rise={dadRise} lean={dadLean} legL={dadLegL} legR={dadLegR} armL={dadArmL} armR={dadArmR} />
      <RoomPresent x={presentX} y={presentY} lid={lid} />
      {sparkles.map(([sx, sy, at], i) => {
        const a = sparkle(at);
        return <motion.path key={i} d={`M${sx} ${sy - 7}v14M${sx - 7} ${sy}h14`} stroke={GOLD} strokeWidth="2.6" strokeLinecap="round" initial={false} animate={{ opacity: a.values }} transition={{ opacity: a.t }} />;
      })}
    </g>
  );
}

/** The family sitting still (for the open-your-gift page and the Christmas page picture). */
function FamilySitting({ kidJump = false }: { kidJump?: boolean }) {
  return (
    <g>
      <Member x={hold(176)} {...MOM} />
      <motion.g animate={kidJump ? { y: [0, -14, 0, -8, 0] } : { y: 0 }} transition={{ duration: 1, ease: "easeOut" }}>
        <Member x={hold(228)} scale={KID_SCALE} {...KID} />
      </motion.g>
      <Member x={hold(278)} {...DAD} />
    </g>
  );
}

/**
 * The living room. With `story`, the family plays out the whole present
 * scene on the room's clock (ROOM_S seconds). Otherwise `arrive` slides the
 * present in under the tree (after `arriveDelay` seconds); without it the
 * present is already there.
 */
export function LivingRoom({ story = false, arrive = true, arriveDelay = 0.4, showPresent = true }: { story?: boolean; arrive?: boolean; arriveDelay?: number; showPresent?: boolean }) {
  const [landed, setLanded] = useState(!arrive);
  useEffect(() => {
    if (!arrive || story) return;
    const t = window.setTimeout(() => setLanded(true), (arriveDelay + 1.1) * 1000);
    return () => window.clearTimeout(t);
  }, [arrive, arriveDelay, story]);
  return (
    <g>
      {/* Wall and wood floor */}
      <rect x="-2000" y="-2000" width="4600" height="2292" fill="#24304d" />
      <rect x="-2000" y="292" width="4600" height="2000" fill="#6b4a33" />
      <rect x="-2000" y="292" width="4600" height="6" fill="#55392a" />
      {/* Picture rail */}
      <rect x="-2000" y="120" width="4600" height="4" fill="#2d3b5e" />
      {/* Window with snow falling outside */}
      <defs>
        <clipPath id="room-window">
          <rect x="34" y="70" width="64" height="110" rx="4" />
        </clipPath>
      </defs>
      <rect x="28" y="64" width="76" height="122" rx="6" fill="#e8dcc8" />
      <rect x="34" y="70" width="64" height="110" rx="4" fill={NIGHT} />
      <g clipPath="url(#room-window)">
        <circle cx="84" cy="88" r="9" fill="#f3efe0" />
        <Snow x={30} y={40} w={74} h={160} count={14} seed={3} />
        <rect x="34" y="166" width="64" height="14" fill={SNOW} />
      </g>
      <rect x="64" y="70" width="4" height="110" fill="#e8dcc8" />
      <rect x="34" y="123" width="64" height="4" fill="#e8dcc8" />
      {/* Wreath on the wall */}
      <circle cx="226" cy="112" r="20" fill="none" stroke="#1d6b3c" strokeWidth="10" />
      <circle cx="226" cy="132" r="5" fill={RED} />
      {/* Rug */}
      <ellipse cx="300" cy="316" rx="210" ry="18" fill={RED_DARK} />
      <Couch />
      <ChristmasTree cx={440} base={290} />
      {/* Presents already under the tree */}
      <SmallGift x={470} y={276} w={26} h={16} box="#2c9656" ribbon="#fff" />
      <SmallGift x={392} y={280} w={20} h={12} box="#7cc4f0" ribbon={RED} />
      {story ? (
        <FamilyStory />
      ) : (
        <>
          <FamilySitting kidJump={landed && arrive} />
          {/* The delivered present slides in from the door on the left */}
          {showPresent && (
            <motion.g initial={arrive ? { x: -420, y: 0 } : false} animate={{ x: 0, y: [0, 0] }} transition={{ delay: arriveDelay, duration: 1.1, ease: [0.2, 0.8, 0.3, 1] }}>
              <g transform="translate(440 292)">
                <motion.g animate={landed ? { scaleY: [1, 0.86, 1.05, 1] } : {}} transition={{ duration: 0.45 }} style={{ originX: "50%", originY: "100%" }}>
                  <Present s={0.85} />
                </motion.g>
              </g>
            </motion.g>
          )}
          {/* Sparkles once it's under the tree */}
          <AnimatePresence>
            {landed &&
              [
                [404, 236],
                [480, 230],
                [500, 266],
              ].map(([x, y], i) => (
                <motion.path key={i} d={`M${x} ${y - 7}v14M${x - 7} ${y}h14`} stroke={GOLD} strokeWidth="2.6" strokeLinecap="round" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ delay: i * 0.12, duration: 0.9 }} />
              ))}
          </AnimatePresence>
        </>
      )}
    </g>
  );
}

/** The street scene runs on one clock (STREET_S seconds); see `track`. */
const STREET_S = 7.2;

// The truck rolls 656 units with wheels of radius 11, so they turn this far, eased exactly like the truck.
const TRUCK_FROM = -420;
const TRUCK_AT = 236;
const ROLL = ((TRUCK_AT - TRUCK_FROM) / 11) * (180 / Math.PI);
const ARRIVE: Easing = [0.22, 1, 0.36, 1];
// The driver walks from the cab to the doorstep while their legs swing.
const WALK_FROM = 2.75;
const WALK_TO = 4.6;
const STEP = 0.31;

/** The house at the end of the street: walls, snowy roof, glowing window, wreath on the door that opens. */
function House() {
  const door = track([
    [0, 1],
    [5.85, 1],
    [6.15, 0.12],
    [STREET_S, 0.12],
  ]);
  return (
    <g>
      <rect x="430" y="168" width="22" height="40" fill="#5b3a2c" />
      <rect x="426" y="162" width="30" height="10" rx="4" fill={SNOW} />
      <rect x="380" y="196" width="190" height="104" fill="#8f5a3c" />
      <path d="M366 200L475 120L584 200Z" fill="#4a2c2a" />
      <path d="M366 200L475 120L584 200L572 206L475 136L378 206Z" fill={SNOW} />
      {/* Window, warm and lit */}
      <rect x="400" y="222" width="46" height="40" rx="3" fill="#f4c76b" />
      <rect x="421" y="222" width="4" height="40" fill="#8f5a3c" />
      <rect x="400" y="240" width="46" height="4" fill="#8f5a3c" />
      <rect x="396" y="262" width="54" height="5" rx="2" fill={SNOW} />
      {/* Warm light behind the door, then the door swinging open from its hinge */}
      <rect x="490" y="232" width="40" height="68" fill="#f4c76b" />
      <motion.g initial={false} animate={{ scaleX: door.values }} transition={{ scaleX: door.t }} style={{ originX: "0%", originY: "50%" }}>
        <rect x="490" y="232" width="40" height="68" fill="#2f6f7e" />
        <circle cx="510" cy="252" r="9" fill="none" stroke="#1d6b3c" strokeWidth="5" />
        <circle cx="510" cy="262" r="3" fill={RED} />
        <circle cx="523" cy="270" r="2" fill={GOLD} />
      </motion.g>
      <rect x="484" y="296" width="52" height="6" fill="#c9d6e3" />
    </g>
  );
}

/** The delivery truck, facing right. (0, 0) is where its back wheel touches the road. Wheels roll with the truck; the cab door opens for the driver. */
function Truck() {
  const roll = track(
    [
      [0, 0],
      [2.2, ROLL],
      [STREET_S, ROLL],
    ],
    [ARRIVE, "linear"],
  );
  const door = track([
    [0, 1],
    [2.35, 1],
    [2.6, 0.1],
    [2.95, 0.1],
    [3.2, 1],
    [STREET_S, 1],
  ]);
  const wheel = (cx: number) => (
    <motion.g initial={false} animate={{ rotate: roll.values }} transition={{ rotate: roll.t }} style={{ originX: "50%", originY: "50%" }}>
      <circle cx={cx} cy="-10" r="11" fill="#1e2a36" />
      <circle cx={cx} cy="-10" r="4.5" fill="#9fb0c0" />
      <rect x={cx - 1} y="-20" width="2" height="20" fill="#9fb0c0" />
    </motion.g>
  );
  return (
    <g>
      {/* Cargo box with the Coastline wave */}
      <rect x="-30" y="-78" width="104" height="62" rx="5" fill="#0e4471" />
      <path d="M-14 -50c6-5 12-5 18 0s12 5 18 0 12-5 18 0" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M-8 -38c5-4 10-4 15 0s10 4 15 0 10-4 15 0" stroke="#86bbea" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="48" cy="-64" r="5" fill={GOLD} />
      {/* Snow on the roof */}
      <rect x="-30" y="-82" width="104" height="6" rx="3" fill={SNOW} />
      {/* Cab, with the inside showing when the door opens */}
      <path d="M74 -58h26l16 20v22H74z" fill={RED} />
      <rect x="76" y="-55" width="24" height="38" fill="#3a1412" />
      <motion.g initial={false} animate={{ scaleX: door.values }} transition={{ scaleX: door.t }} style={{ originX: "100%", originY: "50%" }}>
        <rect x="76" y="-55" width="24" height="38" rx="2" fill={RED_LIGHT} />
        <rect x="80" y="-52" width="17" height="14" rx="1" fill="#bfe1f5" />
        <rect x="80" y="-31" width="7" height="2.5" rx="1" fill={RED_DARK} />
      </motion.g>
      <path d="M100 -52l8 14h-8z" fill="#bfe1f5" />
      <rect x="110" y="-30" width="8" height="6" rx="2" fill="#f4c76b" />
      <rect x="-32" y="-18" width="152" height="8" rx="3" fill="#2a3540" />
      {wheel(-8)}
      {wheel(92)}
    </g>
  );
}

/** When the driver lets go of the present; the doorstep copy appears at the same moment. */
const SET_DOWN = 5.15;
/**
 * The delivery driver, feet on the snow, facing right. Steps out of the cab
 * with the present, walks to the house, crouches to set it on the step,
 * then stands, turns and waves.
 */
function Driver() {
  const x = track(
    [
      [0, 322],
      [2.45, 322],
      [WALK_FROM, 344],
      [WALK_TO, 474],
      [STREET_S, 474],
    ],
    ["linear", "easeOut", "linear", "linear"],
  );
  const shown = track([
    [0, 0],
    [2.45, 0],
    [2.65, 1],
    [STREET_S, 1],
  ]);
  // A small bob with each step, then the crouch to set the present down.
  const body = track([[0, 0], ...swing(WALK_FROM, WALK_TO, STEP / 2, 0, -1.4), [WALK_TO, 0], [4.95, 5], [5.3, 5], [5.65, 0], [STREET_S, 0]]);
  const lean = track([
    [0, 0],
    [WALK_TO, 0],
    [4.95, 16],
    [5.3, 16],
    [5.65, 0],
    [STREET_S, 0],
  ]);
  const legA = track([[0, 0], ...swing(WALK_FROM, WALK_TO, STEP, -22, 22), [WALK_TO, 0], [STREET_S, 0]]);
  const legB = track([[0, 0], ...swing(WALK_FROM, WALK_TO, STEP, 22, -22), [WALK_TO, 0], [STREET_S, 0]]);
  // Arms hold the present out front, drop after setting it down, then one waves.
  const armFront = track([
    [0, -75],
    [SET_DOWN, -75],
    [5.5, 0],
    [STREET_S, 0],
  ]);
  const armWave = track([[0, -75], [SET_DOWN, -75], [5.5, 0], [5.95, -150], ...swing(6.15, 7.15, 0.25, -130, -160), [STREET_S, -150]]);
  const carry = track([
    [0, 1],
    [SET_DOWN - 0.01, 1],
    [SET_DOWN, 0],
    [STREET_S, 0],
  ]);
  const face = track([
    [0, 1],
    [5.6, 1],
    [5.8, -1],
    [STREET_S, -1],
  ]);
  const leg = (anim: ReturnType<typeof track<number>>, dx: number) => (
    <motion.g initial={false} animate={{ rotate: anim.values }} transition={{ rotate: anim.t }} style={{ originX: "50%", originY: "0%" }}>
      <rect x={dx - 3} y="-20" width="6.5" height="18" rx="3" fill="#26354d" />
      <rect x={dx - 3} y="-4" width="9" height="4.5" rx="2" fill="#141c26" />
    </motion.g>
  );
  const arm = (anim: ReturnType<typeof track<number>>) => (
    <motion.g initial={false} animate={{ rotate: anim.values }} transition={{ rotate: anim.t }} style={{ originX: "50%", originY: "0%" }}>
      <rect x="-2.5" y="-41" width="5.5" height="17" rx="2.75" fill="#0e4471" />
      <circle cx="0.25" cy="-23" r="3" fill="#c98d62" />
    </motion.g>
  );
  return (
    <motion.g initial={false} animate={{ x: x.values, opacity: shown.values }} transition={{ x: x.t, opacity: shown.t }}>
      <g transform="translate(0 302)">
        <motion.g initial={false} animate={{ scaleX: face.values }} transition={{ scaleX: face.t }} style={{ originX: "50%", originY: "100%" }}>
          {leg(legB, -1)}
          {leg(legA, 2)}
          <motion.g initial={false} animate={{ y: body.values, rotate: lean.values }} transition={{ y: body.t, rotate: lean.t }} style={{ originX: "50%", originY: "100%" }}>
            {arm(armWave)}
            {/* Jacket with a sun-yellow stripe, head, cap */}
            <rect x="-9" y="-44" width="18" height="26" rx="6" fill="#0e4471" />
            <rect x="-9" y="-33" width="18" height="3.5" fill={GOLD} />
            <circle cx="1" cy="-52" r="7.5" fill="#c98d62" />
            <path d="M-6.5 -54a7.5 7.5 0 0 1 15 0z" fill="#0e4471" />
            <rect x="5" y="-55.5" width="7" height="2.5" rx="1.2" fill="#0e4471" />
            <circle cx="4" cy="-52" r="1.1" fill="#2a1a12" />
            {/* The present, held out front until it's set on the step */}
            <motion.g initial={false} animate={{ opacity: carry.values }} transition={{ opacity: carry.t }}>
              <g transform="translate(17 -24)">
                <Present s={0.55} />
              </g>
            </motion.g>
            {arm(armFront)}
          </motion.g>
        </motion.g>
      </g>
    </motion.g>
  );
}

/**
 * The truck rolls up a snowy street and eases to a stop by the house. The
 * driver steps out with the present, walks to the door, sets it on the step,
 * and waves; the door opens and the present goes inside. STREET_S seconds.
 */
export function DeliveryStreet() {
  const truck = track(
    [
      [0, TRUCK_FROM],
      [2.2, TRUCK_AT],
      [STREET_S, TRUCK_AT],
    ],
    [ARRIVE, "linear"],
  );
  // A little dip on the springs as it stops.
  const settle = track([
    [0, 0],
    [2.15, 0],
    [2.35, 1.6],
    [2.6, 0],
    [STREET_S, 0],
  ]);
  // The present on the step: appears as the driver lets go, then slides in through the open door.
  const stepX = track([
    [0, 491],
    [6.15, 491],
    [6.7, 512],
    [STREET_S, 512],
  ]);
  const stepShown = track([
    [0, 0],
    [SET_DOWN - 0.01, 0],
    [SET_DOWN, 1],
    [6.2, 1],
    [6.7, 0],
    [STREET_S, 0],
  ]);
  return (
    <g>
      <rect x="-2000" y="-2000" width="4600" height="2310" fill={NIGHT} />
      {/* Stars, twinkling in place */}
      {seeded(16, 11).map((r, i) => (
        <circle key={i} className="cp-twinkle" cx={-60 + r * 720} cy={20 + ((i * 37) % 110)} r={i % 3 === 0 ? 1.8 : 1.2} fill="#fff" style={vars({ t: 2 + (i % 4) * 0.5, d: -(i % 6) * 0.3 })} />
      ))}
      <circle cx="96" cy="64" r="22" fill="#f3efe0" />
      <circle cx="106" cy="58" r="20" fill={NIGHT} />
      {/* Snowy hills behind */}
      <ellipse cx="80" cy="300" rx="260" ry="60" fill={SNOW_SHADE} />
      <ellipse cx="560" cy="304" rx="280" ry="50" fill={SNOW_SHADE} />
      {/* Little pines */}
      {[40, 120, 300].map((x, i) => (
        <g key={x} transform={`translate(${x} ${266 + (i % 2) * 6})`}>
          <path d="M0 -40L-14 -12H14Z" fill={PINE[i % 3]} />
          <path d="M0 -26L-18 4H18Z" fill={PINE[(i + 1) % 3]} />
          <path d="M0 -40L-7 -26H7Z" fill={SNOW} />
        </g>
      ))}
      <House />
      {/* The present on the step, just inside the door frame */}
      <motion.g initial={false} animate={{ x: stepX.values, opacity: stepShown.values }} transition={{ x: stepX.t, opacity: stepShown.t }}>
        <g transform="translate(0 300)">
          <Present s={0.55} />
        </g>
      </motion.g>
      {/* Ground and road */}
      <rect x="-2000" y="302" width="4600" height="2000" fill={SNOW} />
      <rect x="-2000" y="306" width="4600" height="22" fill="#56616d" />
      <rect x="-2000" y="316" width="4600" height="2" fill="#8a96a3" />
      <motion.g initial={false} animate={{ x: truck.values, y: settle.values }} transition={{ x: truck.t, y: settle.t }}>
        <g transform="translate(0 316)">
          <Truck />
        </g>
      </motion.g>
      <Driver />
      {/* Starts far above the top so it falls from the sky on tall phone screens too */}
      <Snow x={-200} y={-520} w={1000} h={900} count={110} seed={7} />
    </g>
  );
}

/** The ending of the holiday send-off: the delivery, then (cross-fading) the living room with the present arriving under the tree. */
export const HOLIDAY_FINALE_MS = (STREET_S + ROOM_S) * 1000;
export function HolidayFinale({ viewBox, className }: { viewBox: string; className: string }) {
  const [inside, setInside] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setInside(true), STREET_S * 1000);
    return () => window.clearTimeout(t);
  }, []);
  // On tall screens the send-off zooms in on the middle; here each scene picks its own middle
  // (the truck and the door, then the couch and the tree).
  const tall = viewBox !== "0 0 600 360";
  const view = !tall ? viewBox : inside ? "150 40 380 320" : "196 60 394 300";
  return (
    <motion.svg viewBox={view} preserveAspectRatio="xMidYMid meet" className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} aria-hidden>
      <HolidayStyles />
      {/* Both scenes overlap while one fades into the other */}
      <AnimatePresence>
        {inside ? (
          <motion.g key="room" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, ease: "easeInOut" }}>
            <LivingRoom story />
          </motion.g>
        ) : (
          <motion.g key="street" exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: "easeInOut" }}>
            <DeliveryStreet />
          </motion.g>
        )}
      </AnimatePresence>
    </motion.svg>
  );
}

/** A string of lights draped across the top of a section, twinkling. Stretches to any width. */
export function LightString({ className }: { className?: string }) {
  const n = 24;
  return (
    <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className={className} aria-hidden>
      <HolidayStyles />
      <path d="M0 8 Q100 40 200 8 T400 8 T600 8 T800 8 T1000 8 T1200 8" stroke="#0d3a20" strokeWidth="2.5" fill="none" />
      {Array.from({ length: n }, (_, i) => {
        const x = 25 + i * 50;
        // On the curve: each 200-wide swag dips 16 at its middle.
        const t = (x % 200) / 200;
        const y = 8 + Math.sin(t * Math.PI) * 16;
        return (
          <g key={i}>
            <rect x={x - 3} y={y} width="6" height="6" rx="1" fill="#2a3540" />
            <ellipse className="cp-twinkle" cx={x} cy={y + 14} rx="6" ry="9" fill={BULBS[i % BULBS.length]} style={vars({ t: 1.5 + (i % 4) * 0.3, d: -((i * 0.41) % 1.5) })} />
          </g>
        );
      })}
    </svg>
  );
}

/** The living room as a still picture (the present already under the tree), for the Christmas page. */
export function LivingRoomPicture({ className }: { className?: string }) {
  return (
    <svg viewBox="20 40 560 300" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="A family on the couch by a Christmas tree with presents under it">
      <HolidayStyles />
      <LivingRoom arrive={false} />
    </svg>
  );
}

/** Snow falling over a whole section. */
export function SnowOverlay({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <HolidayStyles />
      <Snow x={0} y={-20} w={600} h={400} count={50} seed={21} opacity={0.6} size={0.5} />
    </svg>
  );
}
