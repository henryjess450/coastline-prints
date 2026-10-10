"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useConfig } from "@/components/ConfigProvider";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { hours, money } from "@/lib/format";
import type { ItemQuote } from "@/lib/pricing/quote";

/** Which machine will print this item. Animates when the assignment changes. */
export function PrinterCard({ quote }: { quote: ItemQuote | null }) {
  const cfg = useConfig();
  const assignment = quote?.assignment ?? null;
  const printer = assignment?.ok ? assignment.printer : null;
  const key = printer?.id ?? (quote && !quote.ok ? "none" : "pending");

  return (
    <Card flat className={cn("overflow-hidden p-0", quote && !quote.ok && "border-danger/60")}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 18, rotate: -1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          exit={{ opacity: 0, y: -14, rotate: 1.5 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="flex items-center gap-5 p-6"
        >
          <PrinterIcon active={!!printer} big={printer ? printer.buildVolume.x > 200 : false} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-faint">{quote && !quote.ok ? "Can't print yet" : printer ? "Printing on" : "Assigning printer"}</p>
            {printer ? (
              <>
                <p className="font-display text-lg font-semibold leading-tight">{printer.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted">
                  Bed {printer.buildVolume.x} × {printer.buildVolume.y} × {printer.buildVolume.z} mm · usable {printer.buildVolume.x - cfg.safetyMarginMm} mm
                </p>
                {/* It fits, but something else stops it (like taking too long to print) */}
                {quote && !quote.ok && <p className="mt-1.5 text-sm text-danger">{quote.error}</p>}
              </>
            ) : quote && !quote.ok ? (
              <p className="mt-0.5 text-sm text-danger">{quote.error}</p>
            ) : (
              <div className="skeleton mt-1 h-5 w-40" />
            )}
          </div>
        </motion.div>
      </AnimatePresence>
      {quote?.ok && (
        <dl className="grid grid-cols-3 border-t border-line text-center">
          <Stat label="Filament" value={<AnimatedNumber value={quote.gramsEach} format={grams} live={false} />} sub="each" />
          <Stat label="Print time" value={<AnimatedNumber value={quote.hoursTotal} format={hours} live={false} />} sub="estimate" />
          <Stat label="Orientation" value={quote.assignment.autoOriented ? "Rotated" : "As uploaded"} sub={quote.assignment.autoOriented ? "to fit" : ""} />
        </dl>
      )}
      {quote?.ok && quote.supportGramsEach >= 0.1 && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="border-t border-line px-4 py-3 text-xs leading-relaxed text-muted">
          <span className="font-semibold text-fg">Supports</span>: this model overhangs, so it prints with about {grams(quote.supportGramsEach)} of tree supports per piece. We remove them for you. They&apos;re in the filament and time above.
        </motion.p>
      )}
      {quote?.ok && quote.multicolor && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="border-t border-line px-4 py-3 text-xs leading-relaxed text-muted">
          <span className="font-semibold text-fg">{quote.multicolor.colors} colours</span>: about {quote.multicolor.changes} filament{" "}
          {quote.multicolor.changes === 1 ? "change" : "changes"} per piece, adding {grams(quote.multicolor.wasteGramsEach)} of flushed plastic and prime tower and{" "}
          {hours(quote.multicolor.changeHoursEach)} of changing time, plus a {money(quote.multicolor.amsFeeCents)} AMS fee for loading the colours. All in the price.
        </motion.p>
      )}
    </Card>
  );
}

const grams = (g: number) => `${g < 10 ? g.toFixed(1) : Math.round(g)} g`;

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="border-line px-2 py-4 [&:not(:last-child)]:border-r">
      <dt className="text-[11px] text-faint">{label}</dt>
      <dd className="font-mono text-sm font-semibold tabular-nums">{value}</dd>
      {sub && <dd className="text-[10px] text-faint">{sub}</dd>}
    </div>
  );
}

/** Tiny printer drawing. The toolhead slides while a printer is assigned. */
function PrinterIcon({ active, big }: { active: boolean; big: boolean }) {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden className="shrink-0">
      <rect x="4" y="4" width="48" height="48" rx="6" fill="var(--surface-strong)" stroke="var(--border-strong)" strokeWidth="2" />
      <rect x="9" y={big ? 40 : 42} width="38" height="4" rx="1" fill={active ? "#4fb3a9" : "var(--border-strong)"} />
      <rect x="8" y="12" width="40" height="3" rx="1" fill="var(--border-strong)" />
      <motion.g animate={active ? { x: [0, 22, 0] } : { x: 11 }} transition={{ duration: 1.6, repeat: active ? Infinity : 0, ease: "easeInOut" }}>
        <rect x="11" y="10" width="12" height="9" rx="2" fill={active ? "#3d7bb8" : "var(--faint)"} />
        <path d="M15 19h4l-2 4z" fill={active ? "#3d7bb8" : "var(--faint)"} />
      </motion.g>
      {active && <rect x="22" y="33" width="12" height="7" rx="1" fill="#e9c46a" />}
    </svg>
  );
}
