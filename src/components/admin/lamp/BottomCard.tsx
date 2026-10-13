"use client";
import { motion } from "framer-motion";
import { useState, useTransition } from "react";
import { identifyLampAction, setBottomAction } from "@/app/admin/lamp-actions";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { IDENTIFY_COLORS } from "@/lib/lamp/animations";

type Step = "idle" | "bottom" | "next";

/**
 * "Set the bottom": the lamp shows a different colour on every LED, you tap
 * the one at the bottom, then the one next to it going clockwise (which also
 * tells us which way round the ring is wired).
 */
export function BottomCard({ offset, showing }: { offset: number; showing: boolean }) {
  const [step, setStep] = useState<Step>(showing ? "bottom" : "idle");
  const [bottom, setBottom] = useState<number | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const show = (on: boolean) =>
    start(async () => {
      const r = await identifyLampAction(on);
      setNote(r.error ? { ok: false, text: r.error } : null);
      setBottom(null);
      setStep(on && !r.error ? "bottom" : "idle");
    });

  const pick = (i: number) => {
    if (step === "bottom") {
      setBottom(i);
      setStep("next");
      setNote(null);
      return;
    }
    start(async () => {
      const r = await setBottomAction(bottom!, i);
      if (r.error) {
        setNote({ ok: false, text: r.error });
        setBottom(null);
        setStep("bottom");
      } else {
        setNote({ ok: true, text: r.message ?? "Bottom set." });
        setStep("idle");
      }
    });
  };

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Set the bottom</h2>
      <p className="mt-1 text-sm text-muted">
        Animations rise from the bottom of the ring. If yours is mounted turned round, show the colours and tell us which LED is at the bottom. Now:{" "}
        <span className="font-semibold text-fg">the LED that shows {IDENTIFY_COLORS[offset].name.toLowerCase()}</span>.
      </p>

      {step === "idle" ? (
        <motion.button type="button" onClick={() => show(true)} disabled={pending} whileTap={{ scale: 0.95 }} className={buttonClass("secondary", "md", "mt-4")}>
          Show the colours on the lamp
        </motion.button>
      ) : (
        <div className="mt-4">
          <p className="text-sm font-semibold">
            {step === "bottom" ? (
              "Which colour is at the bottom of the ring?"
            ) : (
              <>
                <Swatch i={bottom!} small /> is at the bottom. Which colour is next to it, going clockwise (just to its left as you face the lamp)?
              </>
            )}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {IDENTIFY_COLORS.map((c, i) => (
              <motion.button
                key={c.name}
                type="button"
                onClick={() => pick(i)}
                disabled={pending || (step === "next" && i === bottom)}
                whileTap={{ scale: 0.94 }}
                className={cn("flex items-center gap-2 rounded-full border-2 border-line px-3 py-2 text-left text-sm hover:border-line-strong disabled:opacity-40")}
              >
                <Swatch i={i} />
                {c.name}
              </motion.button>
            ))}
          </div>
          <button type="button" onClick={() => show(false)} disabled={pending} className="mt-3 text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
            Cancel (the lamp goes back to normal)
          </button>
        </div>
      )}
      {note && <p className={cn("mt-3 text-sm", note.ok ? "text-success" : "text-danger")}>{note.text}</p>}
    </Card>
  );
}

function Swatch({ i, small }: { i: number; small?: boolean }) {
  const [r, g, b] = IDENTIFY_COLORS[i].rgb;
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-full align-middle", small ? "h-3 w-3" : "h-4 w-4")}
      style={{ background: `rgb(${r} ${g} ${b})`, boxShadow: `0 0 8px rgb(${r} ${g} ${b} / 0.7)` }}
    />
  );
}
