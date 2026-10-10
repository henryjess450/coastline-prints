"use client";
import { motion } from "framer-motion";

/**
 * The admin's greeting, in the sky above the sea: hello by time of day, the
 * date, how much needs doing, and this week at a glance.
 */
export function AdminHero({ hello, date, todo, stats }: { hello: string; date: string; todo: number; stats: { label: string; value: string }[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="pb-10 pt-8 sm:pb-14 sm:pt-12">
        <p className="text-sm text-muted">{date}</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl" aria-label={hello}>
          {hello.split("").map((ch, i) => (
            <motion.span key={i} aria-hidden className="inline-block whitespace-pre" initial={{ y: 30, opacity: 0, rotate: -10 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ delay: 0.1 + i * 0.035, type: "spring", stiffness: 500, damping: 15 }}>
              {ch}
            </motion.span>
          ))}
        </h1>
        <motion.p className="mt-2 text-lg text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {todo === 0 ? "All caught up. Nothing needs you right now." : todo === 1 ? "One thing needs you today." : `${todo} things need you today.`}
        </motion.p>
        <motion.dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-xs uppercase tracking-[0.14em] text-faint">{s.label}</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
