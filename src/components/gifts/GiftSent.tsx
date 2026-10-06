"use client";
import { motion, useReducedMotion } from "framer-motion";
import { ButtonLink } from "@/components/ui/Button";

/**
 * "Your gift is on the way!" with an Apple Pay style checkmark: a single
 * ring draws round from the top, the tick draws in, and it gives a soft pop.
 */
export function GiftSent({ recipientName, when, onAnother }: { recipientName: string; when: string | null; onAnother: () => void }) {
  const reduce = useReducedMotion();
  const first = recipientName.split(/\s+/)[0];
  return (
    <div className="flex flex-col items-center py-8 text-center">
      {/* Apple Pay style: one ring draws round from the top, then the tick draws in, then a soft pop. */}
      <motion.svg width="120" height="120" viewBox="0 0 52 52" initial={{ scale: 1 }} animate={reduce ? { scale: 1 } : { scale: [1, 1, 1.08, 1] }} transition={{ duration: 1.4, times: [0, 0.7, 0.85, 1] }} aria-hidden>
        <circle cx="26" cy="26" r="24" fill="none" stroke="var(--border)" strokeWidth="3" />
        <motion.circle cx="26" cy="26" r="24" fill="none" stroke="var(--accent-line)" strokeWidth="3" strokeLinecap="round" transform="rotate(-90 26 26)" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }} />
        <motion.path d="M15.5 27l7 7L37 19" fill="none" stroke="var(--accent-line)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ delay: reduce ? 0 : 0.65, duration: 0.35, ease: "easeOut" }} />
      </motion.svg>
      <motion.h2 className="mt-8 font-display text-4xl font-bold tracking-tight sm:text-5xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 1, duration: 0.4 }}>
        Your gift is on the way!
      </motion.h2>
      <motion.p className="mt-4 max-w-md text-lg leading-relaxed text-muted" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 1.15, duration: 0.4 }}>
        {when ? (
          <>
            It will arrive in {first}&apos;s inbox on <strong className="text-fg">{when}</strong> at 9 am Pacific.
          </>
        ) : (
          <>It has been sent to {first}&apos;s inbox.</>
        )}{" "}
        Your receipt is on its way to you too.
      </motion.p>
      <motion.div className="mt-10 flex flex-wrap justify-center gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 1.35 }}>
        <button type="button" onClick={onAnother} className="btn btn-primary h-14 px-7 text-base">
          Send another gift
        </button>
        <ButtonLink href="/" size="lg" variant="secondary">
          Back to home
        </ButtonLink>
      </motion.div>
    </div>
  );
}
