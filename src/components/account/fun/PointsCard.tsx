"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { AnimatedCount } from "@/components/motion/AnimatedCount";

type Milestone = { points: number; title: string };

/** Points count up, the bar fills toward the next prize, passed milestones pop, sparkles twinkle. */
export function PointsCard({ balance, pending, milestones }: { balance: number; pending: number; milestones: Milestone[] }) {
  const top = milestones.at(-1)?.points ?? 1;
  const next = milestones.find((m) => m.points > balance);
  const fill = Math.min(1, balance / top);
  return (
    <Link href="/rewards" className="group block">
      <motion.div
        className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 transition-shadow duration-200 group-hover:shadow-[var(--shadow)] sm:p-8"
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
      >
        {/* Twinkling sparkles */}
        {[
          { x: "78%", y: "18%", d: 0 },
          { x: "88%", y: "46%", d: 0.7 },
          { x: "70%", y: "70%", d: 1.3 },
          { x: "93%", y: "14%", d: 1.9 },
        ].map((s, i) => (
          <motion.svg key={i} width="18" height="18" viewBox="0 0 24 24" className="absolute text-sand" style={{ left: s.x, top: s.y }} animate={{ scale: [0, 1, 0], rotate: [0, 90] }} transition={{ duration: 1.6, delay: s.d, repeat: Infinity, repeatDelay: 1.2 }} aria-hidden>
            <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor" />
          </motion.svg>
        ))}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Coastline Rewards</p>
            <p className="font-display text-6xl font-bold tabular-nums text-accent-text">
              <AnimatedCount value={balance} />
              <span className="ml-2 text-2xl text-muted">points</span>
            </p>
          </div>
          {pending > 0 && (
            <motion.span className="rounded-full bg-sand/20 px-3 py-1.5 text-sm font-semibold text-sand" animate={{ y: [0, -5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
              +{pending} on the way
            </motion.span>
          )}
        </div>

        {/* Progress along all the prizes, with a tick at each one */}
        <div className="relative mt-8 h-3 rounded-full bg-surface-strong">
          <motion.div className="h-full rounded-full bg-accent-line" initial={{ width: 0 }} animate={{ width: `${fill * 100}%` }} transition={{ delay: 0.5, duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
          {milestones.map((m, i) => {
            const reached = balance >= m.points;
            return (
              <motion.span
                key={m.points}
                className={`absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${reached ? "border-accent-line bg-sand" : "border-line-strong bg-bg"}`}
                style={{ left: `${(m.points / top) * 100}%` }}
                initial={{ scale: 0 }}
                animate={{ scale: reached ? [0, 1.5, 1] : 1 }}
                transition={{ delay: 0.5 + (m.points / top) * 1.4 + i * 0.02, duration: 0.4 }}
                title={`${m.points}: ${m.title}`}
              />
            );
          })}
        </div>
        <p className="mt-4 text-sm text-muted">
          {next ? (
            <>
              <strong className="text-fg">{next.points - balance}</strong> more points to <strong className="text-fg">{next.title}</strong>
            </>
          ) : (
            "You can pick any prize!"
          )}
          <span className="ml-2 inline-block text-accent-text transition-transform duration-200 group-hover:translate-x-1">See prizes →</span>
        </p>
      </motion.div>
    </Link>
  );
}
