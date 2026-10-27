import "server-only";
import { randomBytes } from "node:crypto";
import type { PosRegister } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { PAIR_ALPHABET, PAIR_LENGTH, normalizePairCode, type PosScreen } from "./types";

/** The customer display's cookie (its displayToken). */
export const DISPLAY_COOKIE = "cp_pos";
export const DISPLAY_COOKIE_DAYS = 365;

function pairCode() {
  const b = randomBytes(PAIR_LENGTH);
  return Array.from(b, (n) => PAIR_ALPHABET[n % PAIR_ALPHABET.length]).join("");
}

/** What a display (or the cashier) gets back on each poll. */
export function displayState(r: PosRegister) {
  return { paired: !!r.pairedAt, pairCode: r.pairedAt ? null : r.pairCode, screen: JSON.parse(r.screen) as PosScreen, version: r.version };
}

/** A new display, waiting to be paired. Old displays nobody paired are cleared out. */
export async function createDisplay() {
  await db.posRegister.deleteMany({ where: { pairedAt: null, createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
  for (let i = 0; i < 5; i++) {
    const code = pairCode();
    if (await db.posRegister.findUnique({ where: { pairCode: code } })) continue;
    return db.posRegister.create({ data: { pairCode: code, displayToken: randomBytes(24).toString("base64url") } });
  }
  throw new Error("Couldn't make a pair code");
}

export async function displayByToken(token: string | undefined) {
  if (!token) return null;
  const r = await db.posRegister.findUnique({ where: { displayToken: token } });
  // Note it's alive, at most every 20 s, so the register can say when the display went quiet.
  if (r && Date.now() - r.lastSeenAt.getTime() > 20_000) await db.posRegister.update({ where: { id: r.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  return r;
}

/** The cashier typed the code shown on a display. */
export async function pairByCode(raw: string) {
  const code = normalizePairCode(raw);
  if (code.length !== PAIR_LENGTH) return null;
  const r = await db.posRegister.findUnique({ where: { pairCode: code } });
  if (!r) return null;
  return db.posRegister.update({ where: { id: r.id }, data: { pairCode: null, pairedAt: new Date(), screen: JSON.stringify({ stage: "idle" }), customerEmail: null, version: { increment: 1 } } });
}

/** What the display should show now. A fresh cart clears the last customer's email. */
export async function pushScreen(id: string, screen: PosScreen, opts: { clearEmail?: boolean } = {}) {
  const { count } = await db.posRegister.updateMany({ where: { id, pairedAt: { not: null } }, data: { screen: JSON.stringify(screen), version: { increment: 1 }, ...(opts.clearEmail ? { customerEmail: null } : {}) } });
  return count > 0;
}

/** The customer typed their email (or "" for no thanks). Only while the display is asking. */
export async function emailFromDisplay(r: PosRegister, email: string) {
  const screen = JSON.parse(r.screen) as PosScreen;
  if (screen.stage !== "email") return false;
  await db.posRegister.update({ where: { id: r.id }, data: { customerEmail: email, screen: JSON.stringify({ ...screen, stage: "cart", email }), version: { increment: 1 } } });
  return true;
}
