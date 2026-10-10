"use client";
import { motion } from "framer-motion";
import type { ColorConfig, MaterialId } from "@config/materials";
import { uploads } from "@config/site";
import { useConfig } from "@/components/ConfigProvider";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { useOrder, type CartItem } from "@/lib/order/store";
import { filePalette } from "@/lib/model/palette";

export function OptionsPanel({ item }: { item: CartItem }) {
  const s = useOrder();
  const cfg = useConfig();
  const mat = cfg.materials.find((m) => m.id === item.material) ?? cfg.materials[0];
  const colors = mat.colors.filter((c) => c.available);
  const selectedColor = colors.find((c) => c.id === item.colorId);
  const painted = !!item.colorMap && (item.fileColors?.used.length ?? 0) > 1;

  return (
    <div className="space-y-7">
      <div className="space-y-2.5">
        <span className="text-sm font-medium text-fg">Material</span>
        <Segmented<MaterialId>
          label="Material"
          value={item.material}
          onChange={(v) => s.setMaterial(item.key, v, cfg)}
          options={cfg.materials.map((m) => ({
            value: m.id,
            label: m.name,
            hint: m.description,
          }))}
        />
        <motion.p key={mat.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-xs leading-relaxed text-muted">
          {mat.description}
        </motion.p>
      </div>

      {painted ? (
        <MultiColour item={item} colors={colors} />
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span id={`color-label-${item.key}`} className="text-sm font-medium text-fg">
              Colour
            </span>
            <motion.span key={selectedColor?.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="truncate text-xs text-muted">
              {selectedColor?.name}
              {selectedColor?.pricePerGramCents != null && ` · ${selectedColor.pricePerGramCents}¢/g`}
            </motion.span>
          </div>
          {(item.fileColors?.used.length ?? 0) > 1 && (
            <button type="button" onClick={() => s.setMulticolour(item.key, true, cfg)} className="w-full rounded-xl bg-accent-soft px-3 py-2 text-left text-xs leading-relaxed text-muted hover:text-fg">
              This file is painted in {item.fileColors!.used.length} colours. <span className="font-semibold text-accent-text underline underline-offset-2">Print it in colour</span>
            </button>
          )}
          <Swatches labelledBy={`color-label-${item.key}`} colors={colors} value={item.colorId} onChange={(id) => s.update(item.key, { colorId: id })} />
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2.5">
          <span className="text-sm font-medium text-fg">Quality</span>
          <Segmented
            label="Print quality"
            value={item.quality}
            onChange={(v) => s.update(item.key, { quality: v })}
            options={cfg.qualityPresets.map((q) => ({
              value: q.id,
              label: q.name,
              hint: `${q.layerHeightMm} mm layers. ${q.description}`,
            }))}
          />
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium text-fg">Quantity</span>
          <QuantityStepper value={item.quantity} onChange={(q) => s.update(item.key, { quantity: q })} />
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-fg">Infill (strength)</span>
        <Segmented
          label="Infill"
          value={item.infill}
          onChange={(v) => s.update(item.key, { infill: v })}
          options={cfg.infillPresets.map((p) => ({
            value: p.id,
            label: p.name,
            hint: `${Math.round(p.infillFraction * 100)}% infill. ${p.description}`,
          }))}
        />
      </div>
    </div>
  );
}

function QuantityStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const max = uploads.maxQuantityPerItem;
  const btn = "grid h-9 w-9 place-items-center rounded-full text-lg font-bold text-fg transition-colors hover:bg-accent hover:text-accent-ink disabled:opacity-30";
  return (
    <div className="flex items-center justify-between rounded-full border-2 border-line bg-surface p-0.5">
      <motion.button
        type="button"
        whileTap={{ scale: 0.8, rotate: -10 }}
        className={btn}
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Decrease quantity"
      >
        −
      </motion.button>
      <motion.output
        key={value}
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="font-mono text-sm font-semibold tabular-nums"
        aria-live="polite"
        aria-label="Quantity"
      >
        {value}
      </motion.output>
      <motion.button
        type="button"
        whileTap={{ scale: 0.8, rotate: 10 }}
        className={btn}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        +
      </motion.button>
    </div>
  );
}

/** Solid swatches. The rainbow spool is shown as hard colour bands, not a blend. */
function swatchStyle(c: ColorConfig): React.CSSProperties {
  if (c.finish === "gradient") {
    return {
      background: "conic-gradient(#e63946 0 60deg, #f77f00 60deg 120deg, #fcbf49 120deg 180deg, #2a9d8f 180deg 240deg, #3a86ff 240deg 300deg, #8338ec 300deg 360deg)",
    };
  }
  if (c.finish === "translucent") return { background: c.hex, opacity: 0.85 };
  return { background: c.hex };
}

/** A row of colour swatches to pick one from. */
function Swatches({ colors, value, onChange, labelledBy, small }: { colors: ColorConfig[]; value: string; onChange: (id: string) => void; labelledBy: string; small?: boolean }) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={cn("flex flex-wrap gap-2.5", small && "gap-2")}>
      {colors.map((c) => {
        const active = c.id === value;
        return (
          <motion.button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c.name}
            title={c.name}
            onClick={() => onChange(c.id)}
            whileHover={{ y: -3, rotate: -6 }}
            whileTap={{ scale: 0.85 }}
            animate={{
              y: active ? -2 : 0,
              scale: active ? [1, 1.2, 1] : 1,
            }}
            transition={{
              scale: { duration: 0.3 },
              y: { type: "spring", stiffness: 400, damping: 18 },
            }}
            className={cn("relative overflow-hidden rounded-full border-2", small ? "h-7 w-7" : "h-9 w-9", active ? "border-white outline-2 outline-offset-2 outline-accent-line" : "border-line")}
            style={swatchStyle(c)}
          >
            {c.finish === "translucent" && <span className="absolute inset-y-0 right-0 w-1/3 bg-white/35" aria-hidden />}
            {c.finish === "silk" && <span className="absolute left-1 top-1 h-2 w-2 rounded-sm bg-white/80" aria-hidden />}
          </motion.button>
        );
      })}
    </div>
  );
}

/**
 * A painted 3MF in colour: each colour in the file gets one of the stock
 * colours (closest match picked to start). The preview follows along.
 */
function MultiColour({ item, colors }: { item: CartItem; colors: ColorConfig[] }) {
  const s = useOrder();
  const cfg = useConfig();
  const fc = item.fileColors!;
  const map = item.colorMap!;
  const fileHex = filePalette(fc.filaments, fc.used);
  const distinct = new Set(Object.values(map)).size;
  const most = Math.max(...cfg.printers.filter((p) => p.materials.includes(item.material)).map((p) => p.maxColors ?? 1));
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-fg">Colours</span>
        <button type="button" onClick={() => s.setMulticolour(item.key, false, cfg)} className="text-xs text-accent-text underline underline-offset-4">
          Print in one colour instead
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        This file is painted in {fc.used.length} colours. We matched each one to our closest filament; change any of them below.
      </p>
      <ul className="space-y-3">
        {fc.used.map((n, idx) => {
          const chosen = colors.find((c) => c.id === map[n]);
          const share = fc.shares?.[n];
          return (
            <motion.li key={n} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className="rounded-2xl border border-line p-3">
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="h-4 w-4 shrink-0 rounded-full border border-line-strong" style={{ background: fileHex[n] }} aria-hidden />
                <span id={`fc-${item.key}-${n}`} className="text-muted">
                  File colour {n}
                  {share != null && <span className="text-faint"> · {Math.max(1, Math.round(share * 100))}% of the surface</span>}
                </span>
                <span aria-hidden className="text-faint">→</span>
                <motion.span key={chosen?.id} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="truncate font-medium text-fg">
                  {chosen?.name ?? "Pick a colour"}
                </motion.span>
              </div>
              <Swatches small labelledBy={`fc-${item.key}-${n}`} colors={colors} value={map[n]} onChange={(id) => s.setColorFor(item.key, n, id)} />
            </motion.li>
          );
        })}
      </ul>
      {distinct > most && <p className="text-xs text-danger">We can print up to {most} colours in one piece. Pick the same colour for some of them.</p>}
    </div>
  );
}
