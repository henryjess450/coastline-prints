"use client";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type Step = { title: string; body: string };

/**
 * Four steps. On wide screens the illustration sticks beside the text and
 * changes as each step scrolls past the middle of the screen. On phones each
 * step carries its own illustration.
 */
export function HowItWorks({ steps }: { steps: Step[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-24">
      <div className="hidden lg:block">
        <div className="sticky top-28 grid aspect-[5/4] place-items-center rounded-3xl border border-line bg-surface">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className="w-3/4"
            >
              <Illustration step={active} />
            </motion.div>
          </AnimatePresence>
          <div className="absolute bottom-5 flex gap-2" aria-hidden>
            {steps.map((s, i) => (
              <span key={s.title} className={cn("h-2 rounded-full transition-all duration-300", i === active ? "w-6 bg-accent-line" : "w-2 bg-line-strong")} />
            ))}
          </div>
        </div>
      </div>
      <ol className="space-y-8 lg:space-y-0">
        {steps.map((s, i) => (
          <StepItem key={s.title} step={s} index={i} active={i === active} onActive={setActive} />
        ))}
      </ol>
    </div>
  );
}

function StepItem({ step, index, active, onActive }: { step: Step; index: number; active: boolean; onActive: (i: number) => void }) {
  const ref = useRef<HTMLLIElement>(null);
  // "Active" while the step crosses the middle band of the viewport.
  const centred = useInView(ref, { margin: "-45% 0px -45% 0px" });
  const seen = useInView(ref, { once: true, amount: 0.4 });
  useEffect(() => {
    if (centred) onActive(index);
  }, [centred, onActive, index]);

  return (
    <li ref={ref} className="lg:flex lg:min-h-[60vh] lg:items-center">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={seen ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={cn("rounded-3xl border border-line bg-surface p-8 transition-colors duration-300 lg:border-transparent lg:bg-transparent lg:p-0", active && "lg:text-fg")}
      >
        <div className="mb-8 grid aspect-[5/3] place-items-center rounded-2xl bg-surface-strong lg:hidden">
          <div className="w-2/3">{seen && <Illustration step={index} />}</div>
        </div>
        <span
          className={cn(
            "grid h-10 w-10 place-items-center rounded-full font-display text-lg font-bold transition-colors duration-300",
            active ? "bg-accent text-accent-ink" : "bg-surface-strong text-muted lg:bg-surface-strong",
          )}
        >
          {index + 1}
        </span>
        <h3 className="mt-5 font-display text-2xl font-bold">{step.title}</h3>
        <p className="mt-3 max-w-md leading-relaxed text-muted">{step.body}</p>
      </motion.div>
    </li>
  );
}

/* ---------- Illustrations (solid colours, loop gently) ---------- */

const loop = { repeat: Infinity, repeatDelay: 0.6 } as const;

function Illustration({ step }: { step: number }) {
  const reduce = useReducedMotion() ?? false;
  const Comp = [Upload, Size, Pay, Pickup][step] ?? Upload;
  return (
    <svg viewBox="0 0 200 150" className="h-auto w-full" aria-hidden>
      <Comp still={reduce} />
    </svg>
  );
}

function Upload({ still }: { still: boolean }) {
  return (
    <>
      {/* Tray */}
      <rect x="40" y="104" width="120" height="26" rx="13" fill="var(--surface-strong)" stroke="var(--border-strong)" strokeWidth="2" />
      <rect x="54" y="113" width="92" height="8" rx="4" fill="var(--border-strong)" />
      <motion.rect
        x="54"
        y="113"
        height="8"
        rx="4"
        fill="var(--accent-line)"
        initial={{ width: still ? 92 : 0 }}
        animate={{ width: 92 }}
        transition={still ? { duration: 0 } : { duration: 1.1, delay: 0.9, ease: "easeInOut", ...loop, repeatDelay: 1.3 }}
      />
      {/* File */}
      <motion.g
        initial={{ y: still ? 0 : -40, opacity: still ? 1 : 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={still ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 12, ...loop, repeatDelay: 1.8 }}
      >
        <path d="M78 26h34l14 14v52H78z" fill="var(--bg-elev)" stroke="var(--accent-line)" strokeWidth="3" strokeLinejoin="round" />
        <path d="M112 26v14h14" fill="none" stroke="var(--accent-line)" strokeWidth="3" strokeLinejoin="round" />
        <text x="102" y="74" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--accent-text)" fontFamily="var(--font-geist-mono)">
          STL
        </text>
      </motion.g>
    </>
  );
}

function Size({ still }: { still: boolean }) {
  const t = still ? { duration: 0 } : { duration: 1.4, ease: "easeInOut" as const, repeat: Infinity, repeatType: "reverse" as const, repeatDelay: 0.4 };
  return (
    <>
      <line x1="30" y1="128" x2="170" y2="128" stroke="var(--border-strong)" strokeWidth="2" />
      <motion.g style={{ originX: "100px", originY: "128px" }} initial={{ scale: 0.6 }} animate={{ scale: still ? 1 : 1.15 }} transition={t}>
        {/* Isometric cube */}
        <path d="M100 58l34 18v40l-34 12-34-12V76z" fill="var(--accent)" />
        <path d="M100 58l34 18-34 14-34-14z" fill="var(--accent-line)" />
        <path d="M100 90v38l34-12V76z" fill="var(--accent)" opacity="0.7" />
      </motion.g>
      {/* Height arrow */}
      <motion.g initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} transition={t}>
        <line x1="160" y1="56" x2="160" y2="122" stroke="var(--sand)" strokeWidth="3" strokeLinecap="round" />
        <path d="M153 64l7-9 7 9M153 114l7 9 7-9" fill="none" stroke="var(--sand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      <rect x="22" y="22" width="62" height="24" rx="12" fill="var(--bg-elev)" stroke="var(--border-strong)" strokeWidth="2" />
      <text x="53" y="38" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)" fontFamily="var(--font-geist-mono)">
        {still ? "80 mm" : <SizeTicker />}
      </text>
    </>
  );
}

function SizeTicker() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 16), 225);
    return () => clearInterval(id);
  }, []);
  // 60 → 92 → 60 mm, in 4 mm steps.
  return <>{60 + 4 * (tick <= 8 ? tick : 16 - tick)} mm</>;
}

function Pay({ still }: { still: boolean }) {
  return (
    <>
      {/* Phone / terminal */}
      <rect x="108" y="22" width="62" height="106" rx="12" fill="var(--bg-elev)" stroke="var(--border-strong)" strokeWidth="3" />
      <rect x="118" y="36" width="42" height="56" rx="6" fill="var(--surface-strong)" />
      <motion.g
        style={{ originX: "139px", originY: "64px" }}
        initial={{ scale: still ? 1 : 0 }}
        animate={{ scale: 1 }}
        transition={still ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 14, delay: 1, ...loop, repeatDelay: 1.6 }}
      >
        <circle cx="139" cy="64" r="15" fill="var(--success)" />
        <path d="M132 64l5 5 9-10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      <rect x="126" y="104" width="26" height="6" rx="3" fill="var(--border-strong)" />
      {/* Card */}
      <motion.g
        initial={{ x: still ? 0 : -30, rotate: -8 }}
        animate={{ x: still ? 0 : [-30, 6, 0], rotate: -8 }}
        transition={still ? { duration: 0 } : { duration: 1, ease: "easeOut", ...loop, repeatDelay: 1.6 }}
      >
        <rect x="26" y="66" width="86" height="54" rx="9" fill="var(--accent)" />
        <rect x="26" y="78" width="86" height="9" fill="#0a2d4c" />
        <rect x="36" y="98" width="26" height="6" rx="3" fill="#86bbea" />
        <circle cx="98" cy="106" r="6" fill="var(--sand)" />
      </motion.g>
    </>
  );
}

function Pickup({ still }: { still: boolean }) {
  return (
    <>
      <line x1="24" y1="128" x2="176" y2="128" stroke="var(--border-strong)" strokeWidth="2" />
      {/* Box with the wave mark */}
      <motion.g
        initial={{ y: 0 }}
        animate={{ y: still ? 0 : [0, -8, 0] }}
        transition={still ? { duration: 0 } : { duration: 0.9, ease: "easeInOut", ...loop, repeatDelay: 1 }}
      >
        <path d="M44 70h76v58H44z" fill="#c9a26a" />
        <path d="M40 58h84v14H40z" fill="#b48a52" />
        <rect x="76" y="58" width="12" height="70" fill="#e0c08f" />
        <circle cx="62" cy="100" r="11" fill="#0e4471" />
        <path d="M54 101c2.4-2 4.8-2 7.2 0s4.8 2 7.2 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      </motion.g>
      {/* "Ready" chip */}
      <motion.g
        style={{ originX: "150px", originY: "50px" }}
        initial={{ scale: still ? 1 : 0.4, opacity: still ? 1 : 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={still ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 14, delay: 0.5, ...loop, repeatDelay: 1.4 }}
      >
        <rect x="118" y="36" width="66" height="28" rx="14" fill="var(--success)" />
        <path d="M128 50l4 4 7-8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text x="162" y="55" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="var(--font-geist-sans)">
          Ready
        </text>
      </motion.g>
    </>
  );
}
