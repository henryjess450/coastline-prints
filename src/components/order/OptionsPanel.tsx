"use client";
import { motion } from "framer-motion";
import type { ColorConfig, MaterialId } from "@config/materials";
import { uploads } from "@config/site";
import { useConfig } from "@/components/ConfigProvider";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { useOrder, type CartItem } from "@/lib/order/store";

export function OptionsPanel({ item }: { item: CartItem }) {
  const s = useOrder();
  const cfg = useConfig();
  const mat = cfg.materials.find((m) => m.id === item.material) ?? cfg.materials[0];
  const colors = mat.colors.filter((c) => c.available);
  const selectedColor = colors.find((c) => c.id === item.colorId);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="text-sm font-medium text-fg">Material</span>
        <Segmented<MaterialId>
          label="Material"
          value={item.material}
          onChange={(v) => s.setMaterial(item.key, v, cfg)}
          options={cfg.materials.map((m) => ({ value: m.id, label: m.name, hint: m.description }))}
        />
        <p className="text-xs text-muted">{mat.description}</p>
      </div>

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
        <div role="radiogroup" aria-labelledby={`color-label-${item.key}`} className="flex flex-wrap gap-2">
          {colors.map((c) => {
            const active = c.id === item.colorId;
            return (
              <motion.button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={c.name}
                title={c.name}
                onClick={() => s.update(item.key, { colorId: c.id })}
                whileHover={{ y: -3, rotate: -6 }}
                whileTap={{ scale: 0.85 }}
                animate={{ y: active ? -2 : 0 }}
                className={cn(
                  "relative h-9 w-9 overflow-hidden rounded-full border-2",
                  active ? "border-white outline-2 outline-offset-2 outline-accent-line" : "border-line",
                )}
                style={swatchStyle(c)}
              >
                {c.finish === "translucent" && <span className="absolute inset-y-0 right-0 w-1/3 bg-white/35" aria-hidden />}
                {c.finish === "silk" && <span className="absolute left-1 top-1 h-2 w-2 rounded-sm bg-white/80" aria-hidden />}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="text-sm font-medium text-fg">Quality</span>
          <Segmented
            label="Print quality"
            value={item.quality}
            onChange={(v) => s.update(item.key, { quality: v })}
            options={cfg.qualityPresets.map((q) => ({ value: q.id, label: q.name, hint: `${q.layerHeightMm} mm layers. ${q.description}` }))}
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
          options={cfg.infillPresets.map((p) => ({ value: p.id, label: p.name, hint: `${Math.round(p.infillFraction * 100)}% infill. ${p.description}` }))}
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
      <motion.button type="button" whileTap={{ scale: 0.8, rotate: -10 }} className={btn} onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Decrease quantity">
        −
      </motion.button>
      <motion.output key={value} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-mono text-sm font-semibold tabular-nums" aria-live="polite" aria-label="Quantity">
        {value}
      </motion.output>
      <motion.button type="button" whileTap={{ scale: 0.8, rotate: 10 }} className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase quantity">
        +
      </motion.button>
    </div>
  );
}

/** Solid swatches. The rainbow spool is shown as hard colour bands, not a blend. */
function swatchStyle(c: ColorConfig): React.CSSProperties {
  if (c.finish === "gradient") {
    return {
      background:
        "conic-gradient(#e63946 0 60deg, #f77f00 60deg 120deg, #fcbf49 120deg 180deg, #2a9d8f 180deg 240deg, #3a86ff 240deg 300deg, #8338ec 300deg 360deg)",
    };
  }
  if (c.finish === "translucent") return { background: c.hex, opacity: 0.85 };
  return { background: c.hex };
}
