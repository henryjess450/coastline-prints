/**
 * Multicolour helpers shared by the browser and the server (pure): matching a
 * file's colours to stock filament, and naming the result.
 */
import type { ColorConfig } from "@config/materials";

/** File filament number (as a string key) → stock colour id. */
export type ColorMap = Record<string, string>;

/** Which stock colour each colour in a painted file prints in (saved on the order). */
export type ColorSlot = { filament: number; fileHex: string | null; colorId: string; colorName: string; hex: string };

function toLab(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const x = (lin[0] * 0.4124 + lin[1] * 0.3576 + lin[2] * 0.1805) / 0.95047;
  const y = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722;
  const z = (lin[0] * 0.0193 + lin[1] * 0.1192 + lin[2] * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** Perceived lightness (CIE L*), 0 = black, 100 = white. */
export function lightnessOf(hex: string) {
  return toLab(hex)[0];
}

/** How different two colours look (CIE76: about 2.3 is just noticeable). */
export function colorDistance(a: string, b: string) {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** The in-stock colour that looks closest. Gradient spools are never picked automatically. */
export function nearestColor(hex: string, colors: ColorConfig[]): ColorConfig | null {
  let best: ColorConfig | null = null;
  let bestD = Infinity;
  for (const c of colors) {
    if (!c.available || c.finish === "gradient") continue;
    const d = colorDistance(hex, c.hex);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best ?? colors.find((c) => c.available) ?? null;
}

/** Closest stock colour for each colour in the file, keeping any choice that's still valid. */
export function defaultColorMap(used: number[], fileHex: (n: number) => string, colors: ColorConfig[], keep: ColorMap = {}): ColorMap {
  const out: ColorMap = {};
  for (const n of used) {
    const kept = keep[n] && colors.some((c) => c.id === keep[n] && c.available) ? keep[n] : null;
    out[n] = kept ?? nearestColor(fileHex(n), colors)?.id ?? "";
  }
  return out;
}

/** The stock colours a map uses, most-covered first (by surface share). */
export function mappedColors(map: ColorMap, shares: Record<number, number> | undefined, colors: ColorConfig[]) {
  const total = new Map<string, number>();
  for (const [n, id] of Object.entries(map)) total.set(id, (total.get(id) ?? 0) + (shares?.[Number(n)] ?? 1));
  return [...total.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, share]) => ({ color: colors.find((c) => c.id === id), id, share }));
}

/** "Red, White and Black" */
export function listNames(names: string[]) {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
