"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { pickup as cfg } from "@config/pickup";
import { availableDays } from "@/lib/pickup";
import { cn } from "@/lib/cn";

export type PickupChoice = { date: string; time: string } | null;

function hoursSummary() {
  const wk = cfg.hours[1];
  const we = cfg.hours[6];
  const fmt = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;
  return `Weekdays ${wk ? `${fmt(wk[0])} to ${fmt(wk[1])}` : "closed"}, weekends ${we ? `${fmt(we[0])} to ${fmt(we[1])}` : "closed"}.`;
}

/** Date chips + time-slot pills, limited to the shop's pickup schedule. */
export function PickupPicker({ value, onChange, error }: { value: PickupChoice; onChange: (v: PickupChoice) => void; error?: string }) {
  const days = useMemo(() => availableDays(cfg), []);
  const day = days.find((d) => d.date === value?.date) ?? null;

  return (
    <div>
      <p className="text-sm text-muted">
        Prints take about 2 to 5 days, so the earliest pickup is {days[0]?.label ?? "soon"}. {hoursSummary()}
      </p>

      <div role="radiogroup" aria-label="Pickup day" className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">
        {days.map((d) => {
          const active = d.date === value?.date;
          return (
            <motion.button
              key={d.date}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={d.label}
              whileTap={{ scale: 0.94 }}
              onClick={() => onChange({ date: d.date, time: active && value ? value.time : "" })}
              className={cn(
                "flex min-w-[68px] shrink-0 flex-col items-center rounded-2xl border px-3 py-2 transition-colors",
                active ? "border-accent-line bg-accent text-accent-ink" : "border-line bg-surface text-fg hover:border-accent-line",
              )}
            >
              <span className={cn("text-[11px] font-medium uppercase", active ? "text-white/80" : "text-faint")}>{d.weekday}</span>
              <span className="text-sm font-semibold">{d.short}</span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {day && (
          <motion.div key={day.date} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="mt-3">
            <p className="mb-2 text-xs font-medium text-muted">{day.label}: choose a time</p>
            <div role="radiogroup" aria-label={`Pickup time on ${day.label}`} className="flex flex-wrap gap-2">
              {day.slots.map((s) => {
                const active = value?.time === s.time;
                return (
                  <motion.button
                    key={s.time}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => onChange({ date: day.date, time: s.time })}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                      active ? "border-accent-line bg-accent font-semibold text-accent-ink" : "border-line bg-surface text-fg hover:border-accent-line",
                    )}
                  >
                    {s.label}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
