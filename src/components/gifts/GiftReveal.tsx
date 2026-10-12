"use client";
/**
 * The recipient's "open your gift" page. The present arrives (for a holiday
 * card, it slides in under the tree in the living room), then it opens by
 * itself (or on a tap), the lid flies off and the card rises out with its
 * number and PIN.
 */
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HolidayStyles, LivingRoom, Snow } from "@/components/holiday/HolidayScenes";
import { buttonClass } from "@/components/ui/Button";
import { GIFT_WORKS_ON, type GiftDesign } from "@/lib/giftcards/designs";
import { GiftCardFace } from "./GiftCardFace";

type Stage = "arrive" | "present" | "open" | "card";

export type RevealGift = {
  design: GiftDesign;
  amount: string;
  number: string;
  pin: string;
  recipientFirst: string;
  buyerName: string;
  message: string | null;
};

const BOX: Record<GiftDesign, { box: string; lid: string; ribbon: string; knot: string }> = {
  holiday: { box: "#c8322b", lid: "#df4a42", ribbon: "#e9c46a", knot: "#c99a1e" },
  coastline: { box: "#0e4471", lid: "#1a5a90", ribbon: "#e9c46a", knot: "#c99a1e" },
};

/** The big present in the middle of the screen. `open` sends the lid flying. */
function BigPresent({ design, open }: { design: GiftDesign; open: boolean }) {
  const c = BOX[design];
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible" aria-hidden>
      <ellipse cx="100" cy="190" rx="70" ry="8" fill="#000" opacity="0.18" />
      <rect x="35" y="90" width="130" height="98" rx="6" fill={c.box} />
      <rect x="92" y="90" width="16" height="98" fill={c.ribbon} />
      <motion.g
        animate={open ? { y: -190, x: 40, rotate: 28, opacity: 0 } : { y: 0, x: 0, rotate: 0, opacity: 1 }}
        transition={open ? { duration: 0.75, ease: [0.2, 0.7, 0.4, 1] } : {}}
        style={{ originX: "100px", originY: "80px" }}
      >
        <rect x="27" y="68" width="146" height="28" rx="6" fill={c.lid} />
        <rect x="92" y="68" width="16" height="28" fill={c.ribbon} />
        <ellipse cx="82" cy="56" rx="20" ry="11" fill={c.ribbon} transform="rotate(-22 82 56)" />
        <ellipse cx="118" cy="56" rx="20" ry="11" fill={c.ribbon} transform="rotate(22 118 56)" />
        <circle cx="100" cy="62" r="8" fill={c.knot} />
      </motion.g>
      {/* Light bursting out once it's open: solid rays that fade in place */}
      {open &&
        Array.from({ length: 10 }, (_, i) => {
          const a = (-150 + i * 13) * (Math.PI / 180);
          return (
            <motion.line
              key={i}
              x1={100 + Math.cos(a) * 30}
              y1={88 + Math.sin(a) * 30}
              x2={100 + Math.cos(a) * 80}
              y2={88 + Math.sin(a) * 80}
              stroke="#e9c46a"
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1, delay: 0.15 + (i % 3) * 0.06 }}
            />
          );
        })}
    </svg>
  );
}

/** `fill`: fill the parent instead of the screen (for recording reels). */
export function GiftReveal({ gift, orderHref, fill = false }: { gift: RevealGift; orderHref: string; fill?: boolean }) {
  const tallest = fill ? "h-full" : "min-h-[calc(100svh-4rem)]";
  const holiday = gift.design === "holiday";
  const [stage, setStage] = useState<Stage>("arrive");
  const [copied, setCopied] = useState(false);
  const [round, setRound] = useState(0);
  // Tall screens frame the tree (where the present lands) instead of the whole room.
  const [tall, setTall] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-aspect-ratio: 1/1)");
    const fit = () => setTall(m.matches);
    fit();
    m.addEventListener("change", fit);
    return () => m.removeEventListener("change", fit);
  }, []);

  // arrive → present → (opens by itself) → open → card
  useEffect(() => {
    const ms = stage === "arrive" ? (holiday ? 2800 : 900) : stage === "present" ? 1800 : stage === "open" ? 900 : 0;
    if (!ms) return;
    const next: Record<Stage, Stage> = { arrive: "present", present: "open", open: "card", card: "card" };
    const t = window.setTimeout(() => setStage(next[stage]), ms);
    return () => window.clearTimeout(t);
  }, [stage, holiday, round]);

  const replay = () => {
    setStage("arrive");
    setRound((r) => r + 1);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(gift.number.replace(/\s/g, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div key={round} className={`relative ${tallest} overflow-hidden`} style={{ background: holiday ? "#24304d" : "var(--bg)" }}>
      {/* The scene behind: the living room for a holiday card, gentle snow for the rest */}
      <svg viewBox={tall && holiday ? "290 40 290 320" : "0 0 600 360"} preserveAspectRatio={tall && holiday ? "xMidYMax meet" : "xMidYMid slice"} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <HolidayStyles />
        {holiday ? <LivingRoom arriveDelay={0.5} showPresent={stage === "arrive"} /> : <Snow count={30} opacity={0.35} />}
      </svg>
      {/* Dim the room once the present comes forward */}
      <motion.div className="absolute inset-0 bg-black" initial={{ opacity: 0 }} animate={{ opacity: stage === "arrive" ? 0 : holiday ? 0.55 : 0 }} transition={{ duration: 0.5 }} aria-hidden />

      <div className={`relative mx-auto flex ${tallest} max-w-xl flex-col items-center justify-center px-4 py-12 text-center`}>
        <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-2xl font-bold text-white sm:text-3xl" style={holiday ? undefined : { color: "var(--fg)" }}>
          {stage === "card" ? `${holiday ? "Merry Christmas" : "Surprise"}, ${gift.recipientFirst}!` : `${gift.recipientFirst}, a gift from ${gift.buyerName.split(/\s+/)[0]}!`}
        </motion.p>

        <div className="relative mt-8 aspect-square w-60 sm:w-72">
          <AnimatePresence>
            {stage !== "arrive" && stage !== "card" && (
              <motion.button
                type="button"
                onClick={() => stage === "present" && setStage("open")}
                aria-label="Open your gift"
                className="absolute inset-0"
                initial={{ y: 260, scale: 0.4, opacity: 0 }}
                animate={stage === "present" ? { y: [0, -8, 0], scale: 1, opacity: 1, rotate: [0, -3, 3, 0] } : { y: 0, scale: 1, opacity: 1 }}
                exit={{ opacity: 0, y: 30 }}
                transition={stage === "present" ? { y: { duration: 1.2, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 0.6, delay: 0.9 }, scale: { type: "spring", stiffness: 220, damping: 16 }, opacity: { duration: 0.3 } } : { duration: 0.3 }}
              >
                <BigPresent design={gift.design} open={stage === "open"} />
              </motion.button>
            )}
          </AnimatePresence>
          {/* The card rises out of the box and comes forward */}
          <AnimatePresence>
            {(stage === "open" || stage === "card") && (
              <motion.div
                className="absolute left-1/2 top-1/2 w-[22rem] max-w-[90vw] text-[14px]"
                initial={{ x: "-50%", y: "10%", scale: 0.35, opacity: 0 }}
                animate={stage === "card" ? { x: "-50%", y: "-50%", scale: 1, opacity: 1 } : { x: "-50%", y: "-60%", scale: 0.5, opacity: 1 }}
                transition={{ type: "spring", stiffness: 170, damping: 18 }}
              >
                <GiftCardFace design={gift.design} amount={gift.amount} number={gift.number} pin={gift.pin} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {stage === "present" && (
            <motion.p key="tap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 text-sm" style={{ color: holiday ? "#ffffffcc" : "var(--muted)" }}>
              Opening… or tap it
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {stage === "card" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-6 w-full space-y-5 rounded-3xl border border-line bg-bg p-6 text-left">
              {gift.message && (
                <blockquote className="border-l-4 border-accent-line pl-4">
                  <p className="whitespace-pre-wrap leading-relaxed">{gift.message}</p>
                  <p className="mt-2 text-sm text-muted">{gift.buyerName}</p>
                </blockquote>
              )}
              <p className="text-sm leading-relaxed text-muted">
                A {gift.amount} gift card. At checkout, type the number and PIN into the &ldquo;Coupons or Gift Cards&rdquo; box. It works on {GIFT_WORKS_ON}. What you don&apos;t spend stays on the card, and it doesn&apos;t expire.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href={orderHref} className={buttonClass("primary", "md")}>
                  Start an order
                </Link>
                <Link href="/redeem" className={buttonClass("secondary", "md")}>
                  Save it to my account
                </Link>
                <button type="button" onClick={copy} className={buttonClass("secondary", "md")}>
                  {copied ? "Copied!" : "Copy card number"}
                </button>
              </div>
              <button type="button" onClick={replay} className="text-sm text-accent-text underline underline-offset-4">
                Watch it again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
