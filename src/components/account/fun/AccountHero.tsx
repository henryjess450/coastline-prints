"use client";
import { motion } from "framer-motion";
import { HeroWater } from "@/components/home/HeroWater";

/** The Benchy sails in on little waves while "Ahoy, Sam!" bounces in letter by letter. */
export function AccountHero({ name, email, children }: { name: string; email: string; children?: React.ReactNode }) {
  const greeting = `Ahoy, ${name}!`;
  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <HeroWater surface={{ wide: 0.66, narrow: 0.7 }} boatAt={{ wide: 0.84, narrow: 0.76 }} boatSize={0.62} sunAt={{ x: 0.9, y: 0.24 }} enter enterSeconds={3} />
      </div>
      <div className="flex min-h-[17rem] flex-col justify-start p-6 sm:min-h-[19rem] sm:p-10">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl" aria-label={greeting}>
          {greeting.split("").map((ch, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="inline-block whitespace-pre"
              initial={{ y: 40, opacity: 0, rotate: -12 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.15 + i * 0.045, type: "spring", stiffness: 500, damping: 14 }}
            >
              {ch}
            </motion.span>
          ))}
        </h1>
        <motion.p className="mt-3 text-muted" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + greeting.length * 0.045 }}>
          Signed in as {email}
        </motion.p>
        <motion.div className="mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 + greeting.length * 0.045 }}>
          {children}
        </motion.div>
      </div>
    </section>
  );
}
