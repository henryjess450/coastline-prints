"use client";
import { motion } from "framer-motion";
import { useActionState, useState } from "react";
import { seasons, type SeasonId } from "@config/seasons";
import { saveSeasonAction, type ActionState } from "@/app/admin/actions";
import { cn } from "@/lib/cn";

/** One tile per theme, with its colour and a hint of its decor. Tap one to switch the site to it. */
export function SeasonPicker({ current }: { current: SeasonId }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSeasonAction, {});
  const [picked, setPicked] = useState<SeasonId>(current);
  return (
    <form action={action}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {seasons.map((s) => {
          const on = s.id === picked;
          return (
            <motion.button
              key={s.id}
              type="submit"
              name="season"
              value={s.id}
              onClick={() => setPicked(s.id)}
              disabled={pending}
              whileTap={{ scale: 0.96 }}
              aria-pressed={on}
              className={cn("relative rounded-2xl border-2 p-3 text-left transition-colors disabled:opacity-70", on ? "border-accent-line bg-accent-soft" : "border-line hover:border-line-strong")}
            >
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 shrink-0 rounded-full border border-white/20" style={{ background: s.colors?.dark.accent ?? "#0e4471" }} />
                <span className="font-semibold">{s.name}</span>
              </span>
              <span className="mt-1 block text-xs text-muted">{s.blurb}</span>
              {on && (
                <motion.span layoutId="season-on" className="absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-ink">
                  On
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
      {(state.message || state.error) && !pending && <p className={cn("mt-4 text-sm", state.error ? "text-danger" : "text-success")}>{state.error ?? state.message}</p>}
    </form>
  );
}
