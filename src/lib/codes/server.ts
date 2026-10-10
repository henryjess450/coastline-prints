import "server-only";
import { randomBytes } from "node:crypto";
import type { PromoCode } from "@/generated/prisma/client";
import { logError } from "@/lib/api";
import { inviteProblem } from "@/lib/rewards/invite";
import { db } from "@/lib/db";
import { timingSafeEqual } from "node:crypto";
import { MAX_CODES, normalizeCode, normalizePin, type AppliedCode, type CodeInfo, type CodeKind } from "./apply";

export class CodeError extends Error {}

export function toCodeInfo(c: PromoCode): CodeInfo {
  return {
    code: c.code,
    kind: c.kind as CodeKind,
    percentOff: c.percentOff,
    amountCents: c.amountCents,
    balanceCents: c.balanceCents,
    minOrderCents: c.minOrderCents,
  };
}

/** Why a code can't be used right now, or null if it's fine. */
export function unusableReason(c: PromoCode | null, now = new Date()) {
  if (!c || !c.active) return "That code isn't valid.";
  if (c.expiresAt && c.expiresAt <= now) return "That code has expired.";
  if (c.kind !== "GIFT_CARD" && c.maxUses != null && c.uses >= c.maxUses) return "That code has already been used up.";
  if (c.kind === "GIFT_CARD" && (c.balanceCents ?? 0) <= 0) return "That gift card has no balance left.";
  return null;
}

export function pinMatches(expected: string, given: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Loads codes and checks each one. Entries are "CODE" or, for gift cards,
 * "NUMBER:PIN". A wrong PIN gives the same message as an unknown code.
 * Codes saved to an account only work for that account (`customerId`), and
 * its owner doesn't need the PIN. Invite codes only work on a first order
 * (checked against `email`, who's ordering, when it's known).
 */
export async function lookupCodes(raw: string[], now = new Date(), customerId: string | null = null, email: string | null = null) {
  const entries = new Map<string, string>();
  for (const r of raw) {
    const [c, p = ""] = r.split(":");
    const code = normalizeCode(c);
    if (code && !entries.has(code)) entries.set(code, normalizePin(p));
  }
  const codes = [...entries.keys()].slice(0, MAX_CODES);
  const rows = await db.promoCode.findMany({ where: { code: { in: codes } } });
  const records: PromoCode[] = [];
  const errors: { code: string; reason: string }[] = [];
  for (const code of codes) {
    let row = rows.find((r) => r.code === code) ?? null;
    if (row?.ownerId && row.ownerId !== customerId) {
      errors.push({ code, reason: "That one is saved to an account. Sign in to that account to use it." });
      continue;
    }
    // Fail closed: a 16-digit gift card number always needs its PIN (unless it's saved to this account).
    const owned = !!row?.ownerId && row.ownerId === customerId;
    const needsPin = !owned && !!row && (!!row.pin || (row.kind === "GIFT_CARD" && /^\d{16}$/.test(row.code)));
    if (row && needsPin && !(row.pin && pinMatches(row.pin, entries.get(code)!))) row = null;
    const reason = unusableReason(row, now) ?? (row ? await inviteProblem(row, customerId, email) : null);
    if (reason) errors.push({ code, reason });
    else records.push(row!);
  }
  return { records, errors };
}

/**
 * Holds the codes for a checkout before charging. Each update is
 * conditional (balance still there, uses still under the limit), so two
 * checkouts can't spend the same gift card. All or nothing.
 */
export async function reserveCodes(checkoutId: string, applied: AppliedCode[], records: PromoCode[]) {
  if (!applied.length) return;
  await db.$transaction(async (tx) => {
    // The site-wide sale isn't a code: nothing to hold.
    for (const a of applied.filter((x) => x.kind !== "SALE")) {
      const rec = records.find((r) => r.code === a.code)!;
      const where =
        rec.kind === "GIFT_CARD"
          ? { id: rec.id, active: true, balanceCents: { gte: a.amountCents } }
          : { id: rec.id, active: true, ...(rec.maxUses != null ? { uses: { lt: rec.maxUses } } : {}) };
      const data = rec.kind === "GIFT_CARD" ? { balanceCents: { decrement: a.amountCents } } : { uses: { increment: 1 } };
      const { count } = await tx.promoCode.updateMany({ where, data });
      if (count !== 1) throw new CodeError(`The code ${a.kind === "GIFT_CARD" ? "on your gift card" : a.code} just changed. Please remove it and add it again.`);
      await tx.codeRedemption.create({ data: { codeId: rec.id, checkoutId, amountCents: a.amountCents } });
    }
  });
}

/** Payment failed: give the balance / use back. Safe to call more than once. */
export async function releaseCodes(checkoutId: string) {
  try {
    await db.$transaction(async (tx) => {
      const held = await tx.codeRedemption.findMany({ where: { checkoutId, status: "RESERVED" }, include: { code: true } });
      for (const r of held) {
        const { count } = await tx.codeRedemption.updateMany({ where: { id: r.id, status: "RESERVED" }, data: { status: "RELEASED" } });
        if (count !== 1) continue;
        await tx.promoCode.update({
          where: { id: r.codeId },
          data: r.code.kind === "GIFT_CARD" ? { balanceCents: { increment: r.amountCents } } : { uses: { decrement: 1 } },
        });
      }
    });
  } catch (err) {
    logError("codes:release", err);
  }
}

function randomDigits(n: number) {
  let out = "";
  while (out.length < n) for (const b of randomBytes(n)) if (b < 250 && out.length < n) out += String(b % 10);
  return out;
}

/** Gift cards: 16-digit number. Coupons: 12-digit number. First digit never 0. */
export function generateCode(kind: CodeKind) {
  const lead = `${1 + (randomBytes(1)[0] % 9)}`;
  return kind === "GIFT_CARD" ? `${lead}${randomDigits(15)}` : `${lead}${randomDigits(11)}`;
}

/** Gift card PIN: "CP" + 5 digits. */
export function generatePin() {
  return `CP${randomDigits(5)}`;
}
