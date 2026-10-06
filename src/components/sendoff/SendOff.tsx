"use client";
/**
 * The shared send-off scene used after buying a gift card and after placing
 * an order:
 *   intro     (orders only) the file goes into the printer and prints layer by layer
 *   pack      it drops into a red box and the lid, bow and all, lands
 *   wait      the box bobs gently until Square confirms the payment
 *   conveyor  the box rides a conveyor belt off to the right
 *   sail      the Benchy from the home page sails off with the box on its back deck
 * It covers the whole screen. The box only leaves once the payment has gone
 * through; if it fails, the caller closes the scene and shows the error.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Benchy } from "@/components/brand/Benchy";

export type PayResult = "pending" | "paid" | "failed";
type Stage = "intro" | "pack" | "wait" | "conveyor" | "fly";

const PACK_MS = 2000;
const CONVEYOR_MS = 2300;
/** How long the Benchy takes to sail across, unless the caller says otherwise. */
const FLY_MS = 5000;

/** The scene is drawn in a 600 × 360 space; tall screens zoom in on the middle. Everything
 * outside the frame (belt, sky, clouds) is drawn wide so the whole screen is filled. */
const WIDE_VIEW = "0 0 600 360";
const TALL_VIEW = "140 40 320 300";

export const RED = "#c8322b";
export const RED_LIGHT = "#df4a42";
export const RED_DARK = "#8f1d19";
export const GOLD = "#e9c46a";
export const GOLD_DARK = "#c99a1e";
const LIGHT = "#86bbea";
const MID = "#3d7bb8";

export type Intro = { ms: number; render: (viewBox: string, className: string) => React.ReactNode };

export function SendOff({ result, label, contents, intro, sailMs = FLY_MS, onDone }: { result: PayResult; label: string; contents: React.ReactNode; intro?: Intro; sailMs?: number; onDone: () => void }) {
  // The stage follows from what has happened so far.
  const [introDone, setIntroDone] = useState(!intro);
  const [packed, setPacked] = useState(false);
  const [flying, setFlying] = useState(false);
  const stage: Stage = !introDone ? "intro" : !packed ? "pack" : result !== "paid" ? "wait" : !flying ? "conveyor" : "fly";
  // Kept in refs so a parent re-render (e.g. when the payment result arrives) never restarts a timer.
  const introMs = intro?.ms ?? 0;
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (stage === "intro") {
      const t = window.setTimeout(() => setIntroDone(true), introMs);
      return () => window.clearTimeout(t);
    }
    // Packing always plays in full, then the box waits for the payment if it isn't back yet.
    if (stage === "pack") {
      const t = window.setTimeout(() => setPacked(true), PACK_MS);
      return () => window.clearTimeout(t);
    }
    if (stage === "conveyor") {
      const t = window.setTimeout(() => setFlying(true), CONVEYOR_MS);
      return () => window.clearTimeout(t);
    }
    if (stage === "fly") {
      const t = window.setTimeout(() => done.current(), sailMs);
      return () => window.clearTimeout(t);
    }
  }, [stage, introMs, sailMs]);

  // Fill the screen: hold the page still while the animation plays, and zoom in on phones.
  const [viewBox, setViewBox] = useState(WIDE_VIEW);
  useEffect(() => {
    const fit = () => setViewBox(window.innerWidth < window.innerHeight ? TALL_VIEW : WIDE_VIEW);
    fit();
    window.addEventListener("resize", fit);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", fit);
      document.body.style.overflow = overflow;
    };
  }, []);

  const svg = "absolute inset-0 h-full w-full overflow-visible";
  return (
    <motion.div className="fixed inset-0 z-[60] overflow-hidden bg-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} role="status" aria-label={label}>
      <AnimatePresence mode="wait">
        {stage === "intro" ? (
          <motion.div key="intro" className="absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {intro!.render(viewBox, svg)}
          </motion.div>
        ) : stage !== "fly" ? (
          <motion.svg key="workshop" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className={svg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} aria-hidden>
            <AnimatePresence>{stage === "conveyor" && <Conveyor />}</AnimatePresence>
            <motion.g
              initial={false}
              animate={stage === "conveyor" ? { x: 1500 } : stage === "wait" ? { y: [0, -6, 0] } : { x: 0, y: 0 }}
              transition={stage === "conveyor" ? { duration: CONVEYOR_MS / 1000 - 0.2, ease: [0.55, 0, 0.6, 1], delay: 0.35 } : stage === "wait" ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : {}}
            >
              <GiftBox>{contents}</GiftBox>
            </motion.g>
          </motion.svg>
        ) : (
          <Sea key="sea" viewBox={viewBox} className={svg} sailMs={sailMs} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Red box with a gold ribbon. Whatever is passed in drops into it before the lid (with its bow) lands.
 * Draw the contents so they finish inside x 246 to 354, y 210 to 290, behind the front of the box. */
export function GiftBox({ children }: { children: React.ReactNode }) {
  return (
    <g>
      {/* Shadow on the floor */}
      <motion.ellipse cx="300" cy="306" rx="88" ry="9" fill="#000" opacity={0.12} />
      {/* Inside of the box, seen through the open top */}
      <rect x="230" y="186" width="140" height="18" rx="4" fill={RED_DARK} />
      {/* The contents drop in */}
      <motion.g initial={{ y: -250, rotate: -8 }} animate={{ y: 0, rotate: 0 }} transition={{ delay: 0.3, duration: 0.85, ease: [0.5, 0, 0.75, 0] }} style={{ originX: "300px", originY: "246px" }}>
        {children}
      </motion.g>
      {/* Front of the box covers the contents once they're in */}
      <rect x="230" y="200" width="140" height="102" rx="6" fill={RED} />
      <rect x="292" y="200" width="16" height="102" fill={GOLD} />
      <rect x="292" y="200" width="5" height="102" fill={GOLD_DARK} opacity={0.5} />
      {/* Lid, bow and all, drops on with a little bounce */}
      <motion.g initial={{ y: -260 }} animate={{ y: 0 }} transition={{ delay: 1.25, type: "spring", stiffness: 260, damping: 15 }}>
        <rect x="222" y="178" width="156" height="30" rx="6" fill={RED_LIGHT} />
        <rect x="222" y="200" width="156" height="8" fill={RED} opacity={0.6} />
        <rect x="292" y="178" width="16" height="30" fill={GOLD} />
        {/* The bow comes down with the lid */}
        <ellipse cx="282" cy="166" rx="19" ry="11" fill={GOLD} transform="rotate(-22 282 166)" />
        <ellipse cx="318" cy="166" rx="19" ry="11" fill={GOLD} transform="rotate(22 318 166)" />
        <ellipse cx="282" cy="166" rx="9" ry="5" fill={GOLD_DARK} transform="rotate(-22 282 166)" />
        <ellipse cx="318" cy="166" rx="9" ry="5" fill={GOLD_DARK} transform="rotate(22 318 166)" />
        <path d="M296 176l-12 22M304 176l12 22" stroke={GOLD} strokeWidth="6" strokeLinecap="round" />
        <circle cx="300" cy="174" r="8" fill={GOLD_DARK} />
      </motion.g>
      {/* Sparkles fade in and out in place as the lid lands */}
      {[
        { x: 206, y: 160, d: 1.6 },
        { x: 396, y: 150, d: 1.7 },
        { x: 388, y: 240, d: 1.8 },
      ].map((p, i) => (
        <motion.path
          key={i}
          d={`M${p.x} ${p.y - 9}v18M${p.x - 9} ${p.y}h18`}
          stroke={GOLD}
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ delay: p.d, duration: 0.8, ease: "easeInOut" }}
        />
      ))}
    </g>
  );
}

/** Belt with sliding treads. */
export function Conveyor() {
  return (
    <motion.g initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
      <rect x="-2000" y="302" width="4600" height="22" fill="#3d4a57" />
      <motion.line
        x1="-2000"
        y1="304"
        x2="2600"
        y2="304"
        stroke="#6b7c8d"
        strokeWidth="4"
        strokeDasharray="18 14"
        animate={{ strokeDashoffset: [0, -64] }}
        transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
      />
      <rect x="-2000" y="324" width="4600" height="2000" fill="#2a3540" opacity={0.5} />
    </motion.g>
  );
}

/** One wave band, drawn far wider than the screen so it can slide sideways forever. */
function wave(base: number, amp: number, period: number) {
  let d = `M-2000 ${base}`;
  for (let x = -2000; x <= 2600; x += 10) d += ` L${x} ${(base + amp * Math.sin((x / period) * Math.PI * 2)).toFixed(1)}`;
  return `${d} L2600 2400 L-2000 2400 Z`;
}

/** Sky, clouds and rolling waves; the Benchy sails across and off with the gift on its back deck. */
export function Sea({ viewBox, className, sailMs = FLY_MS }: { viewBox: string; className: string; sailMs?: number }) {
  const cloud = (x: number, y: number, s: number) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="46" ry="20" fill="#ffffff" />
      <ellipse cx="-26" cy="4" rx="28" ry="15" fill="#ffffff" />
      <ellipse cx="28" cy="5" rx="30" ry="14" fill="#ffffff" />
      <ellipse cx="6" cy="-14" rx="26" ry="18" fill="#ffffff" />
    </g>
  );
  // Each band slides by exactly one period per loop, so the motion never jumps.
  const band = (base: number, amp: number, period: number, fill: string, seconds: number, reverse = false) => (
    <motion.path d={wave(base, amp, period)} fill={fill} animate={{ x: reverse ? [-period, 0] : [0, -period] }} transition={{ duration: seconds, repeat: Infinity, ease: "linear" }} />
  );
  return (
    <motion.svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} aria-hidden>
      <rect x="-2000" y="-2000" width="4600" height="4400" className="fill-[#17395a] light:fill-[#cfe7f8]" />
      <circle cx="480" cy="80" r="32" fill={GOLD} opacity={0.9} />
      <motion.g opacity={0.6} animate={{ x: [0, -80] }} transition={{ duration: sailMs / 1000 + 1, ease: "linear" }}>
        {cloud(-240, 110, 0.9)}
        {cloud(110, 70, 0.8)}
        {cloud(360, 130, 0.7)}
        {cloud(640, 60, 0.9)}
        {cloud(900, 120, 0.8)}
      </motion.g>

      {band(238, 8, 150, LIGHT, 3.2, true)}
      {band(256, 10, 190, MID, 2.6)}
      {/* The Benchy rides between the waves, bobbing, with the gift on its stern */}
      <motion.g initial={{ x: -320 }} animate={{ x: 1350 }} transition={{ duration: sailMs / 1000, ease: [0.35, 0, 0.75, 0.6] }}>
        <motion.g animate={{ y: [0, -5, 0], rotate: [-2, 2.5, -2] }} transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}>
          <g transform="translate(0 272) scale(1.15)">
            <Benchy />
            <GiftOnDeck />
          </g>
        </motion.g>
      </motion.g>
      {band(286, 9, 170, "#0e4471", 2.2, true)}
      <motion.g opacity={0.9} animate={{ x: [0, -140] }} transition={{ duration: sailMs / 1000 + 1, ease: "linear" }}>
        {cloud(-150, 160, 1.1)}
        {cloud(760, 170, 1.2)}
      </motion.g>
    </motion.svg>
  );
}

/** The little red gift box with its gold ribbon, sitting on the Benchy's back deck (boat coordinates). */
function GiftOnDeck() {
  // Rests on the stern block (top at y = -36).
  return (
    <g>
      <rect x="-72" y="-66" width="32" height="30" rx="3" fill={RED} />
      <rect x="-59" y="-66" width="6" height="30" fill={GOLD} />
      <rect x="-75" y="-72" width="38" height="9" rx="3" fill={RED_LIGHT} />
      <rect x="-59" y="-72" width="6" height="9" fill={GOLD} />
      <ellipse cx="-62" cy="-76" rx="7" ry="4.5" fill={GOLD} transform="rotate(-20 -62 -76)" />
      <ellipse cx="-50" cy="-76" rx="7" ry="4.5" fill={GOLD} transform="rotate(20 -50 -76)" />
      <circle cx="-56" cy="-74" r="3" fill={GOLD_DARK} />
    </g>
  );
}
