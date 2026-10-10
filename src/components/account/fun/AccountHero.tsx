"use client";
import { motion } from "framer-motion";
/** "Ahoy, Sam!" bounces in letter by letter, in the sky above the sea (see SeaPage). */
export function AccountHero({ name, email, children }: { name: string; email: string; children?: React.ReactNode }) {
  const greeting = `Ahoy, ${name}!`;
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6">
      <div className="flex flex-col justify-start pb-10 pt-10 sm:pb-14 sm:pt-16">
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
