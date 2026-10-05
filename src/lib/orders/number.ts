import { randomBytes } from "node:crypto";

// No 0/O/1/I/L so numbers are easy to read out over the phone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** e.g. CP-2610-7Q4K (prefix, YYMM, 4 random chars). */
export function newOrderNumber(now = new Date()) {
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const bytes = randomBytes(4);
  const tail = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `CP-${yymm}-${tail}`;
}

export function newViewToken() {
  return randomBytes(24).toString("base64url");
}
