/** "12.5" → 1250, "" → null, junk → NaN. */
export function parseDollars(s: string): number | null {
  const t = s.trim().replace(/^\$/, "");
  if (!t) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return NaN;
  return Math.round(Number(t) * 100);
}

export const dollars = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2));
