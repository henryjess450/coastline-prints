"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { createContext, useContext, useState } from "react";

export type ActiveOrder = {
  orderNumber: string;
  viewToken: string;
  /** "Printing now" */
  headline: string;
  /** "Your parts are printing now." */
  detail: string;
  /** Labels for the six stages, as this order sees them (pickup or shipped). */
  stages: string[];
  /** Index of the current stage. */
  at: number;
  /** "dragon.stl × 2 · PLA Red Matte" */
  items: string[];
  when:
    | { kind: "pickup"; label: string | null; calendarHref: string | null }
    | { kind: "ship"; place: string; tracking: { number: string; url: string } | null; tracked: boolean };
};

/** Which active order is showing, shared by the heading's arrows and the order below. */
const NowContext = createContext<{ index: number; dir: number; count: number; go: (step: number) => void }>({ index: 0, dir: 1, count: 1, go: () => undefined });

export function NowSwitch({ count, children }: { count: number; children: React.ReactNode }) {
  const [[index, dir], set] = useState<[number, number]>([0, 1]);
  const go = (step: number) => set(([i]) => [(i + step + count) % count, step]);
  return <NowContext.Provider value={{ index, dir, count, go }}>{children}</NowContext.Provider>;
}

/** "2 orders on the way", with arrows to flip between them. */
export function NowTitle() {
  const { index, count, go } = useContext(NowContext);
  if (count < 2) return <>Your order</>;
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span>{count} orders on the way</span>
      <span className="inline-flex items-center gap-2 font-sans text-base font-medium">
        <Arrow dir={-1} onClick={() => go(-1)} />
        <span className="min-w-12 text-center text-sm tabular-nums text-muted">
          {index + 1} of {count}
        </span>
        <Arrow dir={1} onClick={() => go(1)} />
      </span>
    </span>
  );
}

function Arrow({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={dir > 0 ? "Next order" : "Previous order"}
      whileHover={{ x: dir * 3 }}
      whileTap={{ scale: 0.88 }}
      className="grid h-10 w-10 place-items-center rounded-full border border-[var(--sea-wake)]/30 text-accent-text transition-colors hover:border-accent-text"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={dir > 0 ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"} />
      </svg>
    </motion.button>
  );
}

/**
 * Orders still on their way, first thing under the surface, one at a time:
 * what stage it's at in plain words, the stages as a line that fills up, and
 * the one thing they'll want next (the pickup slot with "add to calendar", or
 * tracking). With more than one, the heading's arrows (or a swipe) flip through them.
 */
export function HappeningNow({ orders }: { orders: ActiveOrder[] }) {
  const { index, dir, go } = useContext(NowContext);
  const o = orders[Math.min(index, orders.length - 1)];
  return (
    // Clipped so a sliding order never widens the page; the margin keeps the end-stage pulses whole.
    <div className="overflow-x-clip [overflow-clip-margin:28px]">
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={o.orderNumber}
          custom={dir}
          variants={{ enter: (d: number) => ({ opacity: 0, x: d * 60 }), center: { opacity: 1, x: 0 }, exit: (d: number) => ({ opacity: 0, x: d * -60 }) }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          drag={orders.length > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 70) go(info.offset.x < 0 ? 1 : -1);
          }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 className="font-display text-2xl font-bold sm:text-3xl">{o.headline}</h3>
            <Link href={`/orders/${o.viewToken}`} className="font-mono text-sm text-accent-text underline-offset-4 hover:underline">
              {o.orderNumber} →
            </Link>
          </div>
          <p className="mt-1 text-muted">{o.detail}</p>
          <p className="mt-1 text-sm text-faint">{o.items.join("  ·  ")}</p>

          <StageLine stages={o.stages} at={o.at} />

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            {o.when.kind === "pickup" ? (
              <>
                <span>
                  <span className="text-faint">Pickup </span>
                  <span className="font-semibold">{o.when.label ?? "not booked yet"}</span>
                </span>
                {o.when.calendarHref && (
                  <a href={o.when.calendarHref} className="inline-flex items-center gap-1.5 font-medium text-accent-text underline-offset-4 hover:underline">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <rect x="3" y="5" width="18" height="16" rx="3" />
                      <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
                    </svg>
                    Add to calendar
                  </a>
                )}
              </>
            ) : (
              <>
                <span>
                  <span className="text-faint">Shipping to </span>
                  <span className="font-semibold">{o.when.place}</span>
                </span>
                {o.when.tracking ? (
                  <a href={o.when.tracking.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-text underline-offset-4 hover:underline">
                    Track {o.when.tracking.number}
                  </a>
                ) : (
                  <span className="text-faint">{o.when.tracked ? "Tracking number comes when it ships" : "Lettermail, no tracking"}</span>
                )}
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** The six stages as one line; done stages fill in, the current one pulses. */
function StageLine({ stages, at }: { stages: string[]; at: number }) {
  const reduce = useReducedMotion();
  const fill = at / Math.max(1, stages.length - 1);
  return (
    <div className="mt-7">
      <div className="relative h-1.5 rounded-full bg-[var(--sea-wake)]/20">
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-accent-text" initial={{ width: 0 }} animate={{ width: `${fill * 100}%` }} transition={{ delay: 0.4, duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }} />
        {stages.map((s, i) => {
          const done = i <= at;
          return (
            <span key={s} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${(i / (stages.length - 1)) * 100}%` }}>
              {i === at && !reduce && <motion.span className="absolute inset-0 rounded-full bg-accent-text" animate={{ scale: [1, 1.5, 2.6], opacity: [0, 0.45, 0] }} transition={{ duration: 2, times: [0, 0.25, 1], ease: "easeOut", repeat: Infinity }} />}
              <motion.span
                className={`relative block rounded-full ${done ? "bg-accent-text" : "bg-[var(--sea-3)] ring-2 ring-[var(--sea-wake)]/30"} ${i === at ? "h-4 w-4" : "h-3 w-3"}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4 + (i / stages.length) * 1.1, type: "spring", stiffness: 500, damping: 18 }}
              />
            </span>
          );
        })}
      </div>
      <ol className="mt-3 hidden grid-cols-6 text-[11px] text-faint sm:grid">
        {stages.map((s, i) => (
          <li key={s} className={`${i === 0 ? "text-left" : i === stages.length - 1 ? "text-right" : "text-center"} ${i === at ? "font-semibold text-fg" : ""}`}>
            {s}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-faint sm:hidden">
        Step {at + 1} of {stages.length}: <span className="font-semibold text-fg">{stages[at]}</span>
      </p>
    </div>
  );
}
