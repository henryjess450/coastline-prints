/** "At the stand": lamps packed for a market day, shown on the shop and reservable. Safe to import anywhere. */

export type StandDto = {
  marketId: string;
  name: string;
  place: string;
  date: string;
  startTime: string;
  endTime: string;
  /** "today" or "tomorrow", for the badge. */
  when: "today" | "tomorrow";
  /** Still taking holds: there's a half-hour window left to pick. */
  reservable: boolean;
  /** Half-hour windows a hold can be for ("HH:MM"), on the market's day. */
  windows: { start: string; end: string }[];
  /** How many are left to reserve, by count: "<productId>:<variantId>" for an option packed on its own, "<productId>:" for the rest. */
  left: Record<string, number>;
};

/** Which count a product (or option) draws from. */
export const standPool = (stand: StandDto, productId: string, variantId: string | null) => (variantId != null && `${productId}:${variantId}` in stand.left ? `${productId}:${variantId}` : `${productId}:`);

/** How many of this product (or option) are at the stand and not yet reserved. */
export function standLeft(stand: StandDto | null | undefined, productId: string, variantId: string | null = null) {
  if (!stand) return 0;
  return stand.left[standPool(stand, productId, variantId)] ?? 0;
}

/** Anything of this product at the stand (any option). */
export const atStand = (stand: StandDto | null | undefined, productId: string) => !!stand && Object.entries(stand.left).some(([k, n]) => k.startsWith(`${productId}:`) && n > 0);

/** Checkout: do these cart lines all fit what's at the stand? */
export function standFits(stand: StandDto, lines: { productId: string; variantId: string | null; quantity: number }[]) {
  const want = new Map<string, number>();
  for (const l of lines) {
    const key = standPool(stand, l.productId, l.variantId);
    want.set(key, (want.get(key) ?? 0) + l.quantity);
  }
  return lines.length > 0 && [...want].every(([k, n]) => (stand.left[k] ?? 0) >= n);
}
