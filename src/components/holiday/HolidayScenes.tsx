"use client";
/**
 * The holiday gift card scenes, drawn in a 600 × 360 space (like the
 * send-off) with flat, solid colours:
 *   DeliveryStreet  a delivery truck drives up a snowy street to a house and drops the present at the door
 *   LivingRoom      the tree with twinkling lights, the family on the couch, and the present arriving under the tree
 *   HolidayFinale   both in a row, as the ending of the gift card send-off
 * Everything that repeats (snow, lights, breathing) loops back to where it started.
 */
import { AnimatePresence, motion } from "framer-motion";
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

/** One person on the couch: head, hair, jumper. (x, y) is where they sit. */
function Person({ x, y, skin, hair, jumper, small = false, i }: { x: number; y: number; skin: string; hair: string; jumper: string; small?: boolean; i: number }) {
  const k = small ? 0.78 : 1;
  return (
    <motion.g animate={{ y: [0, -1.6, 0] }} transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}>
      <g transform={`translate(${x} ${y}) scale(${k})`}>
        {/* Jumper */}
        <path d="M-17 0v-30a14 14 0 0 1 14-14h6a14 14 0 0 1 14 14V0z" fill={jumper} />
        <path d="M-10 -18h20" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
        {/* Head and hair */}
        <circle cx="0" cy="-56" r="13" fill={skin} />
        <path d="M-13 -58a13 13 0 0 1 26 0c-4-6-10-8-13-8s-9 2-13 8z" fill={hair} />
        {/* A smile */}
        <path d="M-4 -52q4 3 8 0" stroke="#3a2418" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx="-4.5" cy="-57" r="1.3" fill="#3a2418" />
        <circle cx="4.5" cy="-57" r="1.3" fill="#3a2418" />
      </g>
    </motion.g>
  );
}

/** The couch with the family on it. */
function CouchAndFamily({ kidJump = false }: { kidJump?: boolean }) {
  return (
    <g>
      {/* Couch back, people, then the seat and arms in front of them */}
      <rect x="128" y="196" width="196" height="62" rx="14" fill="#2f6f7e" />
      <Person x={176} y={262} skin="#f1c7a3" hair="#6b3a1e" jumper={RED} i={0} />
      <motion.g animate={kidJump ? { y: [0, -14, 0, -8, 0] } : { y: 0 }} transition={{ duration: 1, ease: "easeOut" }}>
        <Person x={228} y={262} skin="#e0ac7e" hair="#2a1a12" jumper={GOLD} small i={1} />
      </motion.g>
      <Person x={278} y={262} skin="#8d5a3b" hair="#1b1210" jumper="#2c9656" i={2} />
      <rect x="136" y="248" width="180" height="26" rx="8" fill="#3a8496" />
      <rect x="116" y="222" width="26" height="62" rx="10" fill="#2a6372" />
      <rect x="310" y="222" width="26" height="62" rx="10" fill="#2a6372" />
      <rect x="132" y="282" width="8" height="10" fill="#1e3b44" />
      <rect x="312" y="282" width="8" height="10" fill="#1e3b44" />
    </g>
  );
}

/**
 * The living room. `arrive` slides the present in under the tree (with
 * `arriveDelay` seconds of wait first); without it the present is already there.
 */
export function LivingRoom({ arrive = true, arriveDelay = 0.4, showPresent = true }: { arrive?: boolean; arriveDelay?: number; showPresent?: boolean }) {
  const [landed, setLanded] = useState(!arrive);
  useEffect(() => {
    if (!arrive) return;
    const t = window.setTimeout(() => setLanded(true), (arriveDelay + 1.1) * 1000);
    return () => window.clearTimeout(t);
  }, [arrive, arriveDelay]);
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
        <Snow x={30} y={60} w={74} h={140} count={14} seed={3} />
        <rect x="34" y="166" width="64" height="14" fill={SNOW} />
      </g>
      <rect x="64" y="70" width="4" height="110" fill="#e8dcc8" />
      <rect x="34" y="123" width="64" height="4" fill="#e8dcc8" />
      {/* Wreath on the wall */}
      <circle cx="226" cy="112" r="20" fill="none" stroke="#1d6b3c" strokeWidth="10" />
      <circle cx="226" cy="132" r="5" fill={RED} />
      {/* Rug */}
      <ellipse cx="300" cy="316" rx="210" ry="18" fill={RED_DARK} />
      <CouchAndFamily kidJump={landed && arrive} />
      <ChristmasTree cx={440} base={290} />
      {/* Presents already under the tree */}
      <SmallGift x={470} y={276} w={26} h={16} box="#2c9656" ribbon="#fff" />
      <SmallGift x={392} y={280} w={20} h={12} box="#7cc4f0" ribbon={RED} />
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
    </g>
  );
}

/** The house at the end of the street: walls, snowy roof, glowing window, wreath on the door. */
function House({ doorOpen }: { doorOpen: boolean }) {
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
      {/* Door (opens to let the present in) */}
      <rect x="490" y="232" width="40" height="68" fill="#f4c76b" />
      <motion.rect x="490" y="232" width="40" height="68" fill="#2f6f7e" animate={{ scaleX: doorOpen ? 0.15 : 1 }} transition={{ duration: 0.35 }} style={{ originX: "490px" }} />
      <motion.g animate={{ opacity: doorOpen ? 0 : 1 }}>
        <circle cx="510" cy="252" r="9" fill="none" stroke="#1d6b3c" strokeWidth="5" />
        <circle cx="510" cy="262" r="3" fill={RED} />
        <circle cx="523" cy="270" r="2" fill={GOLD} />
      </motion.g>
      <rect x="484" y="296" width="52" height="6" fill="#c9d6e3" />
    </g>
  );
}

/** The delivery truck, facing right. (0, 0) is where its back wheel touches the road. */
function Truck({ spinning }: { spinning: boolean }) {
  const wheel = (cx: number) => (
    <motion.g animate={spinning ? { rotate: [0, 360] } : { rotate: 0 }} transition={spinning ? { duration: 0.5, repeat: Infinity, ease: "linear" } : { duration: 0.2 }} style={{ originX: "50%", originY: "50%" }}>
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
      {/* Cab */}
      <path d="M74 -58h26l16 20v22H74z" fill={RED} />
      <path d="M80 -52h17l11 14H80z" fill="#bfe1f5" />
      <rect x="110" y="-30" width="8" height="6" rx="2" fill="#f4c76b" />
      <rect x="-32" y="-18" width="152" height="8" rx="3" fill="#2a3540" />
      {wheel(-8)}
      {wheel(92)}
    </g>
  );
}

/**
 * The truck drives in, stops by the house, and the present hops from the
 * truck to the door, which opens to take it in. About 3.6 seconds.
 */
export function DeliveryStreet() {
  const [step, setStep] = useState<"drive" | "drop" | "in">("drive");
  useEffect(() => {
    const a = window.setTimeout(() => setStep("drop"), 2000);
    const b = window.setTimeout(() => setStep("in"), 3000);
    return () => (window.clearTimeout(a), window.clearTimeout(b));
  }, []);
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
      <House doorOpen={step === "in"} />
      {/* Ground and road */}
      <rect x="-2000" y="300" width="4600" height="2000" fill={SNOW} />
      <rect x="-2000" y="306" width="4600" height="22" fill="#56616d" />
      <rect x="-2000" y="316" width="4600" height="2" fill="#8a96a3" />
      <motion.g initial={{ x: -420 }} animate={{ x: 236 }} transition={{ duration: 2, ease: [0.25, 0.7, 0.35, 1] }}>
        <g transform="translate(0 316)">
          <Truck spinning={step === "drive"} />
        </g>
      </motion.g>
      {/* The present hops off the back of the truck, onto the step, and in the door */}
      {step !== "drive" && (
        <motion.g
          initial={{ x: 214, y: 236 }}
          animate={step === "drop" ? { x: [214, 350, 470], y: [236, 170, 298] } : { x: 530, y: 298, opacity: 0 }}
          transition={step === "drop" ? { duration: 0.8, ease: "easeInOut", times: [0, 0.5, 1] } : { duration: 0.5, ease: "easeIn" }}
        >
          <Present s={0.75} />
        </motion.g>
      )}
      <Snow />
    </g>
  );
}

/** The ending of the holiday send-off: the delivery, then the living room with the present under the tree. */
export function HolidayFinale({ viewBox, className }: { viewBox: string; className: string }) {
  const [inside, setInside] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setInside(true), 3600);
    return () => window.clearTimeout(t);
  }, []);
  // On tall screens the send-off zooms in on the middle; here each scene picks its own middle
  // (the truck and the door, then the couch and the tree).
  const tall = viewBox !== "0 0 600 360";
  const view = !tall ? viewBox : inside ? "150 40 380 320" : "196 60 394 300";
  return (
    <motion.svg viewBox={view} preserveAspectRatio="xMidYMid meet" className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} aria-hidden>
      <HolidayStyles />
      <AnimatePresence mode="wait">
        {inside ? (
          <motion.g key="room" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
            <LivingRoom arriveDelay={0.5} />
          </motion.g>
        ) : (
          <motion.g key="street" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
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
