import "server-only";
import type { PromoCode } from "@/generated/prisma/client";
import { formatCardNumber, normalizeCode, normalizePin } from "@/lib/codes/apply";
import { pinMatches, unusableReason } from "@/lib/codes/server";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

/** A saved gift card or coupon, as the account page and checkout show it. */
export type WalletItem = {
  code: string;
  number: string;
  kind: "GIFT_CARD" | "PERCENT" | "AMOUNT";
  title: string;
  detail: string;
  balanceCents: number | null;
  expiresAt: string | null;
  usable: boolean;
  reason: string | null;
};

function describe(c: PromoCode, now: Date): WalletItem {
  const gift = c.kind === "GIFT_CARD";
  const reason = unusableReason(c, now);
  const value = gift ? money(c.balanceCents ?? 0) : c.kind === "PERCENT" ? `${c.percentOff}% off` : `${money(c.amountCents ?? 0)} off`;
  return {
    code: c.code,
    number: formatCardNumber(c.code),
    kind: c.kind as WalletItem["kind"],
    title: gift ? `Gift card · ${value} left` : `Coupon · ${value}`,
    detail: [
      gift && c.initialCents ? `Started at ${money(c.initialCents)}` : null,
      c.minOrderCents > 0 ? `On orders of ${money(c.minOrderCents)} or more` : null,
      c.expiresAt ? `Use by ${c.expiresAt.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Vancouver" })}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    balanceCents: gift ? (c.balanceCents ?? 0) : null,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    usable: !reason,
    reason,
  };
}

/** Everything saved to this account, usable ones first. */
export async function walletFor(customerId: string, now = new Date()) {
  const codes = await db.promoCode.findMany({ where: { ownerId: customerId }, orderBy: { savedAt: "desc" } });
  return codes.map((c) => describe(c, now)).sort((a, b) => Number(b.usable) - Number(a.usable));
}

export class SaveError extends Error {}

/**
 * Saves a gift card (number + PIN) or a one-use coupon to an account, which
 * also locks it to that account. Shared promo codes can't be saved: they're
 * meant for everyone.
 */
export async function saveToWallet(customerId: string, rawCode: string, rawPin = "", now = new Date()) {
  const code = normalizeCode(rawCode);
  const row = code ? await db.promoCode.findUnique({ where: { code } }) : null;
  const gift = row?.kind === "GIFT_CARD";
  if (!row || !row.active || (gift && !(row.pin && pinMatches(row.pin, normalizePin(rawPin))))) {
    throw new SaveError(gift || /^\d{16}$/.test(code) ? "That card number and PIN don't match." : "We couldn't find that code. Check it and try again.");
  }
  if (row.ownerId === customerId) throw new SaveError("That's already saved to your account.");
  if (row.ownerId) throw new SaveError("That one is already saved to another account.");
  if (!gift && row.maxUses !== 1) throw new SaveError("That's a shared promo code, so it isn't saved to accounts. Just enter it at checkout.");
  const reason = unusableReason(row, now);
  if (reason) throw new SaveError(reason);

  // Only claims it if nobody else saved it a moment ago.
  const { count } = await db.promoCode.updateMany({ where: { id: row.id, ownerId: null }, data: { ownerId: customerId, savedAt: now } });
  if (count !== 1) throw new SaveError("That one is already saved to another account.");
  return describe({ ...row, ownerId: customerId, savedAt: now }, now);
}
