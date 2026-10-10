import type { Filament } from "./threemf";

/** Shown when a 3MF doesn't say what colour a filament slot is. */
const FALLBACK = ["#E9E9E9", "#D64545", "#3A6FD8", "#2E9E4B", "#F2C230", "#8E4FC4", "#F08A24", "#1F1F1F"];

/** Filament number → colour, from the colours saved in the 3MF project. */
export function filePalette(filaments: Filament[], used: number[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const n of used) out[n] = filaments[n - 1]?.hex ?? FALLBACK[(n - 1) % FALLBACK.length];
  return out;
}
