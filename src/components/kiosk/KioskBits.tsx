"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type KioskMode = "shop" | "order";

/** "Pick → Details → Pay", with the current step lit. */
export function Steps({ at }: { mode?: KioskMode; at: 0 | 1 | 2 }) {
  const steps = ["Pick", "Details", "Pay"];
  return (
    <ol className="flex items-center gap-2 text-sm font-semibold" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={cn("relative grid h-7 w-7 place-items-center rounded-full text-xs", i <= at ? "text-accent-ink" : "bg-elev text-faint")}>
            {i <= at && <motion.span layoutId={i === at ? "kiosk-step" : undefined} className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 420, damping: 30 }} />}
            <span className="relative">{i < at ? "✓" : i + 1}</span>
          </span>
          <span className={i === at ? "text-fg" : "text-faint"}>{s}</span>
          {i < steps.length - 1 && <span className={cn("h-px w-6", i < at ? "bg-accent" : "bg-line")} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

/** "Hi, Sam!" bouncing in letter by letter as they type their name. */
export function Greeting({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return (
    <p className="ll-accent h-14 text-5xl" aria-live="polite">
      {first ? (
        <>
          hi,{" "}
          {[...first].map((ch, i) => (
            <motion.span key={`${i}-${ch}`} className="inline-block" initial={{ y: -18, opacity: 0, rotate: -10 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 16 }}>
              {ch}
            </motion.span>
          ))}
          !
        </>
      ) : (
        "almost done!"
      )}
    </p>
  );
}
