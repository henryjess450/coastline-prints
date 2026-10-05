import "server-only";
import { randomBytes } from "node:crypto";
import type { PromoCode } from "@/generated/prisma/client";
import { logError } from "@/lib/api";
import { db } from "@/lib/db";
import { MAX_CODES, normalizeCode, type AppliedCode, type CodeInfo, type CodeKind } from "./apply";

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

/** Loads codes and checks each one. Unknown and unusable codes give the same message for unknown ones. */
export async function lookupCodes(raw: string[], now = new Date()) {
  const codes = [...new Set(raw.map(normalizeCode).filter(Boolean))].slice(0, MAX_CODES);
  const rows = await db.promoCode.findMany({ where: { code: { in: codes } } });
  const records: PromoCode[] = [];
  const errors: { code: string; reason: string }[] = [];
  for (const code of codes) {
    const row = rows.find((r) => r.code === code) ?? null;
    const reason = unusableReason(row, now);
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
    for (const a of applied) {
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

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function randomBlock(n: number) {
  return Array.from(randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Gift cards: GC-XXXX-XXXX-XXXX (about 60 bits, not guessable). Coupons: CP-XXXXXX. */
export function generateCode(kind: CodeKind) {
  return kind === "GIFT_CARD" ? `GC-${randomBlock(4)}-${randomBlock(4)}-${randomBlock(4)}` : `CP-${randomBlock(6)}`;
}
