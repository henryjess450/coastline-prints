"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AppConfig } from "@/lib/config/types";
import { useOrder } from "@/lib/order/store";
import { HeroWater, SAIL_EVENT } from "./HeroWater";

/**
 * The hero section. Dropping an STL anywhere on it adds the file to the cart
 * and opens the order page, where the upload is already under way.
 */
export function HeroDrop({ config, children }: { config: AppConfig; children: React.ReactNode }) {
  const router = useRouter();
  const addFiles = useOrder((s) => s.addFiles);
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  // The headline and buttons drift away while the Benchy sails off.
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const go = () => setLeaving(true);
    window.addEventListener(SAIL_EVENT, go);
    return () => window.removeEventListener(SAIL_EVENT, go);
  }, []);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <section
      className="relative isolate flex min-h-[42rem] items-start overflow-hidden sm:min-h-[44rem]"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current++;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        addFiles(Array.from(e.dataTransfer.files), config);
        router.push("/order");
      }}
    >
      <HeroWater />
      <motion.div
        className="mx-auto w-full max-w-7xl px-4 pb-20 pt-20 sm:px-6 sm:pb-28 sm:pt-32"
        animate={leaving ? { opacity: 0, x: 40 } : { opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>

      <AnimatePresence>
        {over && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-3xl border-[3px] border-dashed border-accent-line bg-bg/85 sm:inset-4"
          >
            <motion.div initial={{ scale: 0.92, y: 8 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 22 }} className="text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-ink">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M12 4v12M6 10l6 6 6-6M4 20h16" />
                </svg>
              </span>
              <p className="mt-4 font-display text-2xl font-bold">Drop to start your order</p>
              <p className="mt-1 text-sm text-muted">.stl files only</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
