"use client";
import { AnimatePresence, motion, useAnimationControls, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export type BuddyMood = "idle" | "typing" | "busy" | "waiting" | "error" | "happy";
/** Where the buddy looks, -1 to 1 on each axis. Ignored when idle (it follows the pointer then). */
export type BuddyState = { mood: BuddyMood; look?: { x: number; y: number }; errorKey?: number };

/**
 * The account icon from the header, come to life for the sign-in screen. It
 * blinks, follows the pointer, watches you type your email and
 * the code, spins a ring while sending, shakes its head at a wrong code and
 * jumps for joy when you're in. Tap it for a hop.
 */
export function AccountBuddy({ state }: { state: BuddyState }) {
  const reduce = useReducedMotion();
  const { mood } = state;
  const root = useRef<HTMLButtonElement>(null);
  const body = useAnimationControls();
  const [blush, setBlush] = useState(0);

  // Eyes: springy, following the pointer when idle and the form otherwise.
  const ex = useMotionValue(0);
  const ey = useMotionValue(0);
  const eyeX = useSpring(ex, { stiffness: 260, damping: 20 });
  const eyeY = useSpring(ey, { stiffness: 260, damping: 20 });
  useEffect(() => {
    if (mood !== "idle") {
      ex.set((state.look?.x ?? 0) * 2.6);
      ey.set((state.look?.y ?? 0) * 2.2);
      return;
    }
    const follow = (e: PointerEvent) => {
      const r = root.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.36);
      const d = Math.max(1, Math.hypot(dx, dy));
      const k = Math.min(1, d / 160);
      ex.set((dx / d) * 2.6 * k);
      ey.set((dy / d) * 2.2 * k);
    };
    window.addEventListener("pointermove", follow);
    return () => window.removeEventListener("pointermove", follow);
  }, [mood, state.look?.x, state.look?.y, ex, ey]);

  // Head shake for a wrong code.
  useEffect(() => {
    if (mood === "error") void body.start({ x: [0, -9, 9, -6, 6, -3, 0], rotate: [0, -6, 6, -4, 4, 0, 0], transition: { duration: 0.6 } });
  }, [mood, state.errorKey, body]);

  // Jump for joy when signed in.
  useEffect(() => {
    if (mood !== "happy") return;
    void body.start({ y: [0, -34, 0, -14, 0], rotate: [0, -8, 360, 360, 360], scale: [1, 1.08, 1, 1.04, 1], transition: { duration: 1.1, ease: "easeOut" } });
  }, [mood, body]);

  function onTap() {
    if (mood === "happy") return;
    void body.start({ y: [0, -22, 0], scaleY: [1, 0.88, 1.06, 1], transition: { duration: 0.55, ease: "easeOut" } });
    setBlush((n) => n + 1);
  }
  useEffect(() => {
    if (!blush) return;
    const t = setTimeout(() => setBlush(0), 1800);
    return () => clearTimeout(t);
  }, [blush]);

  const blinking = mood !== "happy" && mood !== "error";

  return (
    <div className="relative mx-auto w-36">
      <motion.button
        ref={root}
        type="button"
        onClick={onTap}
        aria-label="Say hi"
        className="block w-full cursor-pointer rounded-full outline-none focus-visible:ring-4 focus-visible:ring-accent-soft"
        // Gentle bob all the time; faster and bouncier while you type.
        animate={reduce ? undefined : { y: mood === "typing" ? [0, -3, 0] : [0, -6, 0] }}
        transition={{ duration: mood === "typing" ? 0.5 : 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 120 120" className="w-full overflow-visible text-accent-text" aria-hidden>
          <circle cx="60" cy="60" r="54" fill="var(--accent-soft)" />

          {/* Spinning ring while the code is on its way */}
          <AnimatePresence>
            {mood === "busy" && (
              <motion.circle
                cx="60"
                cy="60"
                r="58"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="40 24"
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: 1, rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{ rotate: { duration: 1.2, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.2 } }}
                style={{ originX: "50%", originY: "50%" }}
              />
            )}
          </AnimatePresence>

          {/* Sparkles when you're in */}
          {mood === "happy" &&
            Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return (
                <motion.circle
                  key={i}
                  cx="60"
                  cy="60"
                  r={i % 2 ? 3 : 4.5}
                  fill={i % 2 ? "var(--accent)" : "var(--sand)"}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{ x: Math.cos(a) * 66, y: Math.sin(a) * 66, opacity: [0, 1, 1, 0], scale: [0, 1.3, 1, 0.6] }}
                  transition={{ duration: 1, delay: 0.25, ease: "easeOut" }}
                />
              );
            })}

          <motion.g animate={body} style={{ originX: "50%", originY: "80%" }}>
            {/* Body and head, the same shapes as the header's account icon */}
            <path d="M30 98c4-14 15-22 30-22s26 8 30 22" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
            <motion.g animate={{ rotate: mood === "typing" || mood === "waiting" ? 6 : mood === "busy" ? -4 : 0, y: mood === "typing" || mood === "waiting" ? 1.5 : 0 }} transition={{ type: "spring", stiffness: 200, damping: 14 }} style={{ originX: "50%", originY: "100%" }}>
              <circle cx="60" cy="44" r="17" fill="var(--surface)" stroke="currentColor" strokeWidth="6" />

              {/* Eyes */}
              <motion.g style={{ x: eyeX, y: eyeY }}>
                {mood === "happy" ? (
                  <>
                    <path d="M51 43 q3 -4 6 0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                    <path d="M63 43 q3 -4 6 0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </>
                ) : mood === "error" ? (
                  <>
                    <path d="M51 41 l5 3 M51 45 l5 -1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M69 41 l-5 3 M69 45 l-5 -1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </>
                ) : (
                  <motion.g
                    animate={blinking && !reduce ? { scaleY: [1, 1, 0.1, 1, 1, 0.1, 1] } : { scaleY: 1 }}
                    transition={{ duration: 4.2, times: [0, 0.6, 0.63, 0.66, 0.9, 0.93, 0.96], repeat: Infinity }}
                    style={{ originY: "50%" }}
                  >
                    <circle cx="54" cy="43" r={mood === "busy" ? 2.8 : 2.4} fill="currentColor" />
                    <circle cx="66" cy="43" r={mood === "busy" ? 2.8 : 2.4} fill="currentColor" />
                  </motion.g>
                )}
              </motion.g>

              {/* Mouth */}
              {mood === "happy" ? (
                <motion.path d="M53 49 q7 9 14 0 z" fill="currentColor" initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ originX: "50%", originY: "0%" }} />
              ) : mood === "busy" ? (
                <motion.circle cx="60" cy="51" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
              ) : (
                <motion.path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  initial={false}
                  animate={{ d: mood === "error" ? "M55 53 q5 -4 10 0" : mood === "typing" ? "M56 50 q4 2 8 0" : "M54 49 q6 5 12 0" }}
                  transition={{ duration: 0.25 }}
                />
              )}

              {/* Rosy cheeks when you poke it or sign in */}
              <AnimatePresence>
                {(mood === "happy" || blush > 0) && (
                  <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} exit={{ opacity: 0 }}>
                    <circle cx="49" cy="49" r="2.6" fill="var(--sand)" />
                    <circle cx="71" cy="49" r="2.6" fill="var(--sand)" />
                  </motion.g>
                )}
              </AnimatePresence>
            </motion.g>
          </motion.g>
        </svg>
      </motion.button>
    </div>
  );
}
