"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { GiftAnimation } from "@/components/gifts/GiftAnimation";
import { GiftCardFace, Holly } from "@/components/gifts/GiftCardFace";
import { GiftReveal } from "@/components/gifts/GiftReveal";
import { HolidayStyles, Snow } from "@/components/holiday/HolidayScenes";
import { Leaves, Pumpkin, TG_S, ThanksgivingStory } from "@/components/holiday/ThanksgivingScenes";

type Part = "send" | "reveal" | "thanksgiving";

/** One animation, then the end card. Covers the whole screen, header and all. */
export function ReelScene({ part, scale = 1 }: { part: Part; scale?: number }) {
  const [end, setEnd] = useState(false);
  // A beat of plain navy first, so the recording can be trimmed to start clean.
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setGo(true), 1500);
    return () => window.clearTimeout(t);
  }, []);
  // The reveal has no "done" callback: it settles on the card after about 6 seconds.
  useEffect(() => {
    if (part === "send" || !go) return;
    const t = window.setTimeout(() => setEnd(true), part === "reveal" ? 9000 : TG_S * 1000);
    return () => window.clearTimeout(t);
  }, [part, go]);

  // scale 2 when recording on a 1080x1920 screen: lay out at phone size (540x960) and draw it twice
  // as big, so every pixel is real. Full-screen scenes inside stay within this box (a transformed
  // parent contains fixed-position children).

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden" style={{ background: "#10233a" }}>
      {/* No Next.js dev badge in the recording */}
      <style>{"nextjs-portal{display:none!important}"}</style>
      <div className="absolute left-0 top-0 overflow-hidden" style={{ width: `${100 / scale}vw`, height: `${100 / scale}vh`, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
      <AnimatePresence mode="wait">
        {!go ? null : !end ? (
          <motion.div key="play" className="absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            {part === "thanksgiving" ? (
              <ThanksgivingStory tall />
            ) : part === "send" ? (
              <GiftAnimation result="paid" amount="$55.00" design="holiday" onDone={() => setEnd(true)} />
            ) : (
              <div className="absolute inset-0 overflow-hidden [&_.border-line]:hidden">
                <GiftReveal fill orderHref="/order" gift={{ design: "holiday", amount: "$55.00", number: "1234 5678 1234 5678", pin: "CP12345", recipientFirst: "Jordan", buyerName: "Sam", message: null }} />
              </div>
            )}
          </motion.div>
        ) : (
          part === "thanksgiving" ? <ThanksgivingEnd key="end" /> : <EndCard key="end" />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

/** Thanksgiving's last frame: leaves falling, a pumpkin, the greeting. */
function ThanksgivingEnd() {
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center" style={{ background: "#5a3326" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <style>{"@keyframes cp-leaf{from{transform:translate(0,0) rotate(0deg)}to{transform:translate(var(--dx),var(--dy)) rotate(var(--spin))}}.cp-leaf{animation:cp-leaf var(--t) linear var(--d) infinite;transform-box:fill-box;transform-origin:center}"}</style>
        <Leaves x={-100} y={-500} w={800} h={900} count={70} seed={12} wind={40} size={0.9} />
      </svg>
      <motion.svg viewBox="-40 -40 80 50" className="relative w-24" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.15 }}>
        <Pumpkin s={1.8} />
      </motion.svg>
      <motion.p className="relative mt-6 font-display text-4xl font-bold leading-tight text-white" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        Happy Thanksgiving
      </motion.p>
      <motion.p className="relative mt-3 text-lg" style={{ color: "#f5d7a1" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
        coastlineprints.ca
      </motion.p>
    </motion.div>
  );
}

function EndCard() {
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <HolidayStyles />
        <Snow x={0} y={-20} w={600} h={400} count={50} seed={5} opacity={0.6} size={0.6} />
      </svg>
      <motion.div className="relative w-full max-w-xs" initial={{ y: 30, rotate: -6, opacity: 0 }} animate={{ y: 0, rotate: -3, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.2 }}>
        <GiftCardFace design="holiday" amount="$50" to="someone special" className="text-[12px]" />
      </motion.div>
      <motion.p className="relative mt-10 font-display text-3xl font-bold leading-tight text-white" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        Holiday gift cards
      </motion.p>
      <motion.p className="relative mt-3 text-lg text-white/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
        coastlineprints.ca
      </motion.p>
      <Holly className="relative mt-6 w-16" />
    </motion.div>
  );
}
