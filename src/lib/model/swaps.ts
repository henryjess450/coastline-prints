/**
 * Multicolour print cost estimate (pure, shared by browser and server):
 * how many filament changes, how much plastic they flush, how big the prime
 * tower is, and how long the changes take.
 */
import type { multicolor as MulticolorConfig } from "@config/pricing";
import { colorDistance, lightnessOf } from "./colors";
import type { ColorProfile } from "./threemf";

export type ChangeEstimate = {
  /** Filament changes for one piece. */
  changes: number;
  /** Layers that use more than one colour. */
  multiLayers: number;
  /** Plastic flushed by the changes, mm³ (one piece). */
  flushMm3: number;
  /** Prime tower, mm³ (one piece). */
  towerMm3: number;
  /** Time spent changing filament, hours (one piece). */
  hours: number;
};

/** Flushed plastic for one change from colour a to colour b, mm³. */
export function flushVolume(fromHex: string, toHex: string, cfg: typeof MulticolorConfig) {
  if (fromHex.toLowerCase() === toHex.toLowerCase()) return 0;
  const f = cfg.flush;
  const up = Math.max(0, lightnessOf(toHex) - lightnessOf(fromHex));
  return (f.baseMm3 + f.perDeltaEMm3 * colorDistance(fromHex, toHex) + f.perLightnessUpMm3 * up) * f.multiplier;
}

/**
 * Walks the layers of the chosen vertical axis. On each layer every colour
 * present is printed once, starting with the colour already loaded when it's
 * needed, so a layer with k colours costs k − 1 changes (plus one when the
 * loaded colour isn't on the layer at all).
 *
 * `colorOf` turns a file filament number into the stock colour it prints in
 * (several file colours can share one stock colour: no change between them).
 */
export function estimateChanges(opts: {
  profile: ColorProfile;
  /** Original axis that ends up vertical (0 = x, 1 = y, 2 = z). */
  upAxis: number;
  heightMm: number;
  layerHeightMm: number;
  colorOf: (filament: number) => string | undefined;
  hexOf: (stockColor: string) => string;
  cfg: typeof MulticolorConfig;
}): ChangeEstimate {
  const { profile, upAxis, heightMm, layerHeightMm, colorOf, hexOf, cfg } = opts;
  const bins = profile.axes[upAxis] ?? profile.axes[2];
  const layers = Math.max(1, Math.ceil(heightMm / layerHeightMm));
  const setCache = new Map<number, string[]>();
  const colorsIn = (mask: number) => {
    let hit = setCache.get(mask);
    if (!hit) {
      const s = new Set<string>();
      for (let n = 1; n <= 30; n++) if (mask & (2 ** n)) {
        const c = colorOf(n);
        if (c) s.add(c);
      }
      setCache.set(mask, (hit = [...s]));
    }
    return hit;
  };

  let changes = 0;
  let multiLayers = 0;
  let topMulti = -1;
  let flush = 0;
  let loaded: string | null = null;
  for (let l = 0; l < layers; l++) {
    const set = colorsIn(bins[Math.min(profile.bins - 1, Math.floor(((l + 0.5) / layers) * profile.bins))] ?? 0);
    if (!set.length) continue;
    if (set.length > 1) {
      multiLayers++;
      topMulti = l;
    }
    // Start with what's loaded if this layer uses it; finish on a different colour.
    const order: string[] = loaded && set.includes(loaded) ? [loaded, ...set.filter((c) => c !== loaded)] : set;
    for (const c of order) {
      if (loaded && c !== loaded) {
        changes++;
        flush += flushVolume(hexOf(loaded), hexOf(c), cfg);
      }
      loaded = c;
    }
  }

  const t = cfg.primeTower;
  const towerMm3 = topMulti >= 0 ? (topMulti + 1) * layerHeightMm * t.widthMm * t.depthMm * t.fill : 0;
  return { changes, multiLayers, flushMm3: flush, towerMm3, hours: (changes * cfg.secondsPerChange) / 3600 };
}
