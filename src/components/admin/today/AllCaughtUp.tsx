"use client";
import { motion, useReducedMotion } from "framer-motion";
import { BenchyIcon } from "@/components/brand/Benchy";

/** Nothing to do: the Benchy bobs about. Starts and ends level, so the loop never jumps. */
export function AllCaughtUp() {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-center gap-5">
      <motion.div animate={reduce ? undefined : { y: [0, -6, 0], rotate: [0, -4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
        <BenchyIcon size={72} />
      </motion.div>
      <p className="max-w-sm text-muted">All caught up. New orders show up here as soon as they&apos;re paid.</p>
    </div>
  );
}
