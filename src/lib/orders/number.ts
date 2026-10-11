import { randomBytes } from "node:crypto";

// No 0/O/1/I/L so numbers are easy to read out over the phone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** CP for Coastline print orders, LL for LightLab shop orders. */
export type OrderPrefix = "CP" | "LL";

/** Any order number, either prefix, as people type it (any case). */
export const ORDER_NUMBER_RE = /^(CP|LL)-\d{4}-[A-Z0-9]{4}$/i;

/** e.g. CP-2610-7Q4K or LL-2610-7Q4K (prefix, YYMM, 4 random chars). */
export function newOrderNumber(now = new Date(), prefix: OrderPrefix = "CP") {
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const bytes = randomBytes(4);
  const tail = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${prefix}-${yymm}-${tail}`;
}

export function newViewToken() {
  return randomBytes(24).toString("base64url");
}
