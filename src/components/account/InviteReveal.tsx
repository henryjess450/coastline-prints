"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Bat } from "@/components/brand/Benchy";
import { useSeason } from "@/components/season/SeasonContext";

/** Paper stays paper in both themes. */
const PAPER = "#f6ecd2";
const PAPER_EDGE = "#e6d6ad";
const INK = "#0e4471";
const CORK = "#b07a45";
const CORK_DARK = "#8f5f33";
const GLASS = "#8fcfc0";
const SAND = "#e9c46a";

type Phase = "sail" | "pop" | "open";

/**
 * The whole invite page is a scene: sky and sun up top, the sea below. A
 * message in a bottle drifts in on the waves, the cork pops, and the note
 * inside rises into the sky and unrolls to show who sent it and what it's
 * worth. The rest of the page (`children`) sits on the water.
 * Reduced motion: the open note, straight away.
 */
export function InviteReveal({ from, off, children }: { from: string; off: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("sail");
  useEffect(() => {
    if (reduce) return;
    const pop = setTimeout(() => setPhase("pop"), 1900);
    const open = setTimeout(() => setPhase("open"), 2500);
    return () => {
      clearTimeout(pop);
      clearTimeout(open);
    };
  }, [reduce]);
  const shown: Phase = reduce ? "open" : phase;

  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col overflow-x-clip">
      {/* Sky */}
      <div className="relative min-h-[340px] flex-[1.4] sm:min-h-[380px]">
        <motion.span
          aria-hidden
          className="absolute right-[10%] top-10 h-14 w-14 rounded-full sm:h-20 sm:w-20"
          style={{ background: SAND }}
          initial={reduce ? false : { y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
        <Gull top="22%" duration={26} delay={0} size={1} />
        <Gull top="34%" duration={32} delay={-11} size={0.75} />

        {/* The note: rises out of the bottle, then unrolls from the middle out */}
        <AnimatePresence>{shown === "open" && <Note from={from} off={off} instant={!!reduce} />}</AnimatePresence>
      </div>

      {/* Sea */}
      <div className="relative flex-1 pb-24 pt-14" style={{ background: "var(--sea-0)" }}>
        <Wave layer="back" />

        {/* The bottle: sails in, bobs, pops its cork, then sinks away */}
        <AnimatePresence>
          {shown !== "open" && (
            <motion.div
              className="absolute bottom-[calc(100%-10px)] left-1/2 -ml-[90px] w-[180px]"
              initial={reduce ? false : { x: "-60vw", rotate: -14 }}
              animate={{ x: 0, rotate: -8 }}
              exit={{ y: 60, opacity: 0, transition: { duration: 0.5, ease: "easeIn" } }}
              transition={{ type: "spring", stiffness: 36, damping: 12 }}
            >
              <motion.div animate={reduce ? undefined : { y: [0, -7, 0], rotate: [0, 4, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
                <Bottle popped={shown === "pop"} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <Wave layer="front" />

        <motion.div
          className="relative mx-auto max-w-2xl px-4 text-center sm:px-6"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={shown === "open" ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

/** Drawn as one picture so the cork always sits in the neck. */
function Bottle({ popped }: { popped: boolean }) {
  return (
    <svg viewBox="0 0 180 80" className="block w-full overflow-visible" aria-hidden>
      {/* Cork, pushed into the neck; it pops up and away, spinning */}
      <motion.g
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        animate={popped ? { x: [0, 30, 70], y: [0, -80, -20], rotate: [0, 220, 440], opacity: [1, 1, 0] } : undefined}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <rect x="140" y="30" width="22" height="20" rx="3" fill={CORK} />
        <path d="M147 33 V47 M154 33 V47" stroke={CORK_DARK} strokeWidth="1.5" strokeLinecap="round" />
      </motion.g>
      {/* Glass: body, shoulder, neck and lip */}
      <path d="M10 26 Q10 12 26 12 H104 Q118 12 126 26 L132 30 H146 V50 H132 L126 54 Q118 68 104 68 H26 Q10 68 10 54 Z" fill={GLASS} opacity="0.92" />
      <rect x="144" y="28" width="5" height="24" rx="2" fill={GLASS} />
      {/* The rolled note inside */}
      <rect x="30" y="28" width="80" height="24" rx="12" fill={PAPER} />
      <rect x="67" y="28" width="6" height="24" fill={SAND} />
      {/* Shine */}
      <path d="M26 20 H98" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
      {/* A little burst where the cork was */}
      {popped &&
        [0, 1, 2, 3, 4, 5].map((i) => {
          const a = (-80 + i * 32) * (Math.PI / 180);
          return (
            <motion.circle
              key={i}
              cx="152"
              cy="40"
              r="4"
              fill={i % 2 ? SAND : PAPER}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{ x: Math.cos(a) * 50, y: Math.sin(a) * 50, scale: [0, 1.2, 0.6], opacity: [1, 1, 0] }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          );
        })}
    </svg>
  );
}

function Note({ from, off, instant }: { from: string; off: string; instant: boolean }) {
  const unroll = { delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] } as const;
  return (
    <motion.div
      className="absolute inset-x-0 bottom-24 mx-auto w-[min(100%-2rem,440px)] text-center"
      initial={instant ? false : { y: 140, opacity: 0, scale: 0.5 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 130, damping: 17 }}
    >
      <div className="relative px-5">
        <motion.div
          className="rounded-md px-6 pb-7 pt-6 shadow-[var(--shadow)]"
          style={{ background: PAPER, color: INK }}
          initial={instant ? false : { clipPath: "inset(0 46% 0 46%)" }}
          animate={{ clipPath: "inset(0 0% 0 0%)" }}
          transition={unroll}
        >
          <motion.div initial={instant ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.4 }}>
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">{from} sent you</p>
            <h1 className="mt-2 font-display text-6xl font-bold tracking-tight sm:text-7xl">{off} off</h1>
          </motion.div>
        </motion.div>
        {/* The rolled ends, moving apart as it opens */}
        {(["left", "right"] as const).map((side) => (
          <motion.span
            key={side}
            aria-hidden
            className="absolute inset-y-[-6px] w-5 rounded-full"
            style={{ background: PAPER_EDGE }}
            initial={instant ? false : { [side]: "46%" }}
            animate={{ [side]: "0%" }}
            transition={unroll}
          />
        ))}
      </div>
    </motion.div>
  );
}

/** A gull gliding across the sky, flapping now and then (a bat at Halloween). Off-screen at both ends, so the loop never jumps. */
function Gull({ top, duration, delay, size }: { top: string; duration: number; delay: number; size: number }) {
  const reduce = useReducedMotion();
  const bat = useSeason().id === "halloween";
  return (
    <motion.svg
      aria-hidden
      viewBox={bat ? "-24 -14 48 24" : "0 0 24 10"}
      className="absolute left-0 text-muted"
      style={{ top, width: (bat ? 34 : 26) * size }}
      initial={{ x: "-10vw" }}
      animate={reduce ? { x: "20vw" } : { x: ["-10vw", "110vw"] }}
      transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
    >
      {bat ? (
        // Wings beat by squashing the bat up and down; starts and ends open, so it never snaps.
        <motion.g style={{ transformOrigin: "0px 0px" }} animate={reduce ? undefined : { scaleY: [1, 0.3, 1] }} transition={{ duration: 0.38, repeat: Infinity, ease: "easeInOut" }}>
          <Bat x={0} y={0} flap={1} size={1} />
        </motion.g>
      ) : (
        <motion.path
          d="M1 7 Q6 1 12 7 Q18 1 23 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transformOrigin: "center" }}
          animate={reduce ? undefined : { scaleY: [1, 0.4, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
        />
      )}
    </motion.svg>
  );
}

/**
 * The water's surface, across the full width. The back layer (foam) sits
 * behind the bottle and the front layer in front, so it floats between them.
 * Each scrolls exactly one wave length, so the loop never jumps.
 */
function Wave({ layer }: { layer: "back" | "front" }) {
  const reduce = useReducedMotion();
  const back = layer === "back";
  // The front layer also reaches 40px down into the sea, so the bottle's underside stays under water.
  const h = back ? 70 : 80;
  const base = back ? 22 : 16;
  const amp = back ? 10 : 7;
  let d = `M0 ${h} L0 ${base}`;
  for (let x = 0; x <= 1600; x += 10) d += ` L${x} ${(base + amp * Math.sin((x / 200) * Math.PI * 2)).toFixed(1)}`;
  d += ` L1600 ${h} Z`;
  return (
    <div className={`pointer-events-none absolute inset-x-0 overflow-hidden ${back ? "bottom-[calc(100%-1px)]" : "bottom-[calc(100%-40px)]"}`} style={{ height: h }} aria-hidden>
      <motion.svg
        viewBox={`0 0 1600 ${h}`}
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 h-full w-[200%]"
        animate={reduce ? undefined : { x: back ? ["0%", "-50%"] : ["-50%", "0%"] }}
        transition={{ duration: back ? 8 : 6, repeat: Infinity, ease: "linear" }}
      >
        <path d={d} fill={back ? "var(--sea-foam)" : "var(--sea-0)"} />
      </motion.svg>
    </div>
  );
}
