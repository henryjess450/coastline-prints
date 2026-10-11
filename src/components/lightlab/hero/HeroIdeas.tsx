"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { LAMPS, OneLineLamps, type LampId } from "./OneLineLamps";

type Pick = "all" | LampId;

const OPTIONS: { id: Pick; label: string; detail: string }[] = [
  { id: "all", label: "All three", detail: "Fun-gi, Banana After Dark and Cloudy take turns: each is drawn, named, then erased before the next." },
  ...LAMPS.map((l) => ({ id: l.id, label: l.name, detail: `Just ${l.name}, drawn over and over.` })),
];

/** The hero as it is, with the one-line lamps in the spot beside it. */
export function HeroIdeas({ heroText }: { heroText: React.ReactNode }) {
  const [pick, setPick] = useState<Pick>("all");
  const [tone, setTone] = useState<"line" | "blue">("line");
  const option = OPTIONS.find((o) => o.id === pick)!;

  return (
    <div className="overflow-x-clip">
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <p className="ll-accent text-3xl">your lamps, in line</p>
        <p className="mt-1 max-w-2xl text-muted">Fun-gi, Banana After Dark and Cloudy, traced from your outlines and drawn in fine line. Pick one, or all three, to see it beside the hero.</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Pills label="Lamp" value={pick} onChange={setPick} options={OPTIONS.map((o) => ({ id: o.id, label: o.label }))} layoutId="ll-pick" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          Line colour
          <Pills label="Line colour" value={tone} onChange={setTone} options={[{ id: "line", label: "Black and white" }, { id: "blue", label: "LightLab blue" }]} layoutId="ll-tone" small />
        </div>
      </div>

      {/* The hero, as on /lightlab, with the lamps beside it */}
      <section className="mx-auto mt-6 grid max-w-7xl items-center gap-8 border-y border-dashed border-line px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-24">
        {heroText}
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[400px]">
          <AnimatePresence mode="wait">
            <motion.div key={pick} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <OneLineLamps only={pick === "all" ? undefined : pick} tone={tone} />
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
      <p className="mx-auto mt-3 max-w-7xl px-4 text-sm text-muted sm:px-6">
        <strong className="text-fg">{option.label}:</strong> {option.detail}
      </p>

      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
        <h2 className="font-display text-2xl">Every lamp</h2>
        <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {LAMPS.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => {
                  setPick(l.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={cn("block w-full rounded-3xl border bg-surface p-4 transition-[border-color,transform] hover:border-accent-line active:scale-[0.98]", l.id === pick ? "border-accent-line" : "border-line")}
                aria-label={`Show ${l.name} beside the hero`}
              >
                <div className="mx-auto aspect-[4/5] w-full max-w-[260px]">
                  <OneLineLamps only={l.id} tone={tone} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Pills<T extends string>({ label, value, onChange, options, layoutId, small }: { label: string; value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; layoutId: string; small?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.id)} className={cn("relative rounded-full border font-medium transition-colors active:scale-95", small ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm", on ? "border-transparent text-accent-ink" : "border-line text-muted hover:text-fg")}>
            {on && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
