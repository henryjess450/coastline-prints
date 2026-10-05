"use client";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import type { AppConfig } from "@/lib/config/types";
import { hours, money } from "@/lib/format";
import { quoteOrder } from "@/lib/pricing/quote";

const MIN = 10;
const MAX = 200;

/** "Make it bigger": a cube priced by the real pricing engine as you drag. */
export function PriceSlider({ config }: { config: AppConfig }) {
  const [side, setSide] = useState(40);
  const colorId = config.materials[0].colors.find((c) => c.available && c.pricePerGramCents == null)?.id ?? "";
  const quote = useMemo(
    () =>
      quoteOrder(
        [
          {
            size: { x: side, y: side, z: side },
            volumeMm3: side ** 3,
            surfaceAreaMm2: 6 * side ** 2,
            material: "PLA",
            colorId,
            quality: "standard",
            infill: "standard",
            quantity: 1,
          },
        ],
        config,
      ),
    [side, colorId, config],
  );
  const item = quote.items[0];
  const fill = ((side - MIN) / (MAX - MIN)) * 100;
  // The drawn cube grows with the slider, from small to nearly the full box.
  const s = 0.32 + 0.68 * ((side - MIN) / (MAX - MIN));

  return (
    <div className="grid gap-10 rounded-3xl border border-line bg-surface p-8 sm:p-12 md:grid-cols-[1fr_1.2fr] md:items-center md:gap-16">
      <div className="grid aspect-square max-h-72 place-items-center justify-self-center">
        <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden>
          <ellipse cx="80" cy="140" rx="64" ry="9" fill="var(--surface-strong)" />
          <motion.g style={{ originX: "80px", originY: "140px" }} animate={{ scale: s }} transition={{ type: "spring", stiffness: 260, damping: 24 }}>
            <path d="M80 20l60 30v70l-60 22-60-22V50z" fill="var(--accent)" />
            <path d="M80 20l60 30-60 24-60-24z" fill="var(--accent-line)" />
            <path d="M80 74v68l60-22V50z" fill="#0a3156" />
          </motion.g>
        </svg>
      </div>

      <div>
        <label htmlFor="price-size" className="text-sm font-medium text-muted">
          A solid cube in PLA, standard settings
        </label>
        <div className="mt-1 flex items-baseline justify-between gap-4">
          <p className="font-display text-3xl font-bold">
            <span className="font-mono tabular-nums">{side}</span> mm
          </p>
          <AnimatedNumber value={quote.totalCents} format={money} className="font-mono text-3xl font-bold tabular-nums text-accent-text" />
        </div>
        <input
          id="price-size"
          type="range"
          min={MIN}
          max={MAX}
          step={5}
          value={side}
          onChange={(e) => setSide(Number(e.target.value))}
          className="range mt-8 w-full"
          style={{ "--fill": `${fill}%` } as React.CSSProperties}
          aria-valuetext={`${side} millimetre cube, ${money(quote.totalCents)}`}
        />
        <div className="mt-2 flex justify-between text-xs text-faint">
          <span>{MIN} mm</span>
          <span>Make it bigger</span>
          <span>{MAX} mm</span>
        </div>
        {item?.ok && (
          <dl className="mt-8 grid grid-cols-3 gap-4 text-sm">
            <Stat label="Filament" value={`${Math.round(item.gramsEach)} g`} />
            <Stat label="Print time" value={hours(item.hoursTotal)} />
            <Stat label="Printer" value={item.assignment.printer.shortName} />
          </dl>
        )}
        <p className="mt-6 text-xs leading-relaxed text-faint">
          Worked out the same way as at checkout. Most models fill less of their box than a cube does, so they cost less than a cube the same size.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-strong px-4 py-3">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-0.5 truncate font-mono font-medium tabular-nums">{value}</dd>
    </div>
  );
}
