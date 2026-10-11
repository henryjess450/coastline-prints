"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { GiftAnimation } from "@/components/gifts/GiftAnimation";
import { GiftCardFace, Holly } from "@/components/gifts/GiftCardFace";
import { GiftReveal } from "@/components/gifts/GiftReveal";
import { HolidayStyles, Snow } from "@/components/holiday/HolidayScenes";

/** One animation, then the end card. Covers the whole screen, header and all. */
export function ReelScene({ part }: { part: "send" | "reveal" }) {
  const [end, setEnd] = useState(false);
  // A beat of plain navy first, so the recording can be trimmed to start clean.
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setGo(true), 1500);
    return () => window.clearTimeout(t);
  }, []);
  // The reveal has no "done" callback: it settles on the card after about 6 seconds.
  useEffect(() => {
    if (part !== "reveal" || !go) return;
    const t = window.setTimeout(() => setEnd(true), 9000);
    return () => window.clearTimeout(t);
  }, [part, go]);

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden" style={{ background: "#10233a" }}>
      <AnimatePresence mode="wait">
        {!go ? null : !end ? (
          <motion.div key="play" className="absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            {part === "send" ? (
              <GiftAnimation result="paid" amount="$55.00" design="holiday" onDone={() => setEnd(true)} />
            ) : (
              <div className="absolute inset-0 overflow-y-auto [&_.border-line]:hidden">
                <GiftReveal orderHref="/order" gift={{ design: "holiday", amount: "$55.00", number: "1234 5678 1234 5678", pin: "CP12345", recipientFirst: "Jordan", buyerName: "Sam", message: null }} />
              </div>
            )}
          </motion.div>
        ) : (
          <EndCard key="end" />
        )}
      </AnimatePresence>
    </div>
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
