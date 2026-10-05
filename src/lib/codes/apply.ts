/**
 * Coupon and gift card rules. Pure, so the checkout preview and the server
 * compute exactly the same total.
 *
 * - At most one coupon (PERCENT or AMOUNT), applied first.
 * - Up to MAX_GIFT_CARDS gift cards, applied after, each up to its balance.
 * - The total never goes below zero.
 */
export type CodeKind = "PERCENT" | "AMOUNT" | "GIFT_CARD";

/** What the browser is allowed to know about a code. */
export type CodeInfo = {
  code: string;
  kind: CodeKind;
  percentOff: number | null;
  amountCents: number | null;
  balanceCents: number | null;
  minOrderCents: number;
  /** Gift card PIN the customer typed (kept in the browser only, sent at checkout). */
  pin?: string;
};

export type AppliedCode = { code: string; kind: CodeKind; label: string; amountCents: number };

export const MAX_GIFT_CARDS = 3;
export const MAX_CODES = 4;

export function normalizeCode(raw: string) {
  if (isCardNumber(raw)) return raw.replace(/[\s-]/g, "");
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Gift card numbers are 16 digits (spaces and dashes ignored). */
export function isCardNumber(raw: string) {
  return /^\d{16}$/.test(raw.replace(/[\s-]/g, ""));
}

/** "1234567812345678" → "1234 5678 1234 5678" */
export function formatCardNumber(code: string) {
  return /^\d{16}$/.test(code) ? code.replace(/(\d{4})(?=\d)/g, "$1 ") : code;
}

/** "cp 12345" / "12345" → "CP12345" */
export function normalizePin(raw: string) {
  const digits = raw.toUpperCase().replace(/[^0-9]/g, "");
  return digits ? `CP${digits}` : "";
}

/** What the browser sends for each code: "NUMBER:PIN" for gift cards with a PIN. */
export function codeEntry(c: CodeInfo) {
  return c.pin ? `${c.code}:${c.pin}` : c.code;
}

/** Gift cards show only their last 4 characters on receipts and pages. */
export function maskCode(code: string, kind: CodeKind) {
  return kind === "GIFT_CARD" ? `•••• ${code.replace(/-/g, "").slice(-4)}` : code;
}

function label(c: CodeInfo) {
  if (c.kind === "PERCENT") return `Coupon ${c.code} (${c.percentOff}% off)`;
  if (c.kind === "AMOUNT") return `Coupon ${c.code}`;
  return `Gift card ${maskCode(c.code, c.kind)}`;
}

export type ApplyResult = {
  applied: AppliedCode[];
  discountCents: number;
  giftCardCents: number;
  totalCents: number;
  /** Codes that couldn't be used, with a customer-facing reason. */
  rejected: { code: string; reason: string }[];
};

export function applyCodes(orderTotalCents: number, codes: CodeInfo[]): ApplyResult {
  const applied: AppliedCode[] = [];
  const rejected: ApplyResult["rejected"] = [];
  let remaining = orderTotalCents;
  let discountCents = 0;
  let giftCardCents = 0;

  const coupons = codes.filter((c) => c.kind !== "GIFT_CARD");
  const cards = codes.filter((c) => c.kind === "GIFT_CARD");
  coupons.slice(1).forEach((c) => rejected.push({ code: c.code, reason: "Only one coupon can be used per order." }));
  cards.slice(MAX_GIFT_CARDS).forEach((c) => rejected.push({ code: c.code, reason: `Up to ${MAX_GIFT_CARDS} gift cards per order.` }));

  const coupon = coupons[0];
  if (coupon) {
    if (orderTotalCents < coupon.minOrderCents) {
      rejected.push({ code: coupon.code, reason: `This coupon needs an order of at least $${(coupon.minOrderCents / 100).toFixed(2)}.` });
    } else {
      const off = coupon.kind === "PERCENT" ? Math.round((orderTotalCents * (coupon.percentOff ?? 0)) / 100) : (coupon.amountCents ?? 0);
      const amount = Math.min(off, remaining);
      if (amount > 0) {
        applied.push({ code: coupon.code, kind: coupon.kind, label: label(coupon), amountCents: amount });
        remaining -= amount;
        discountCents += amount;
      }
    }
  }

  for (const card of cards.slice(0, MAX_GIFT_CARDS)) {
    if (remaining <= 0) {
      rejected.push({ code: card.code, reason: "Your order is already fully covered." });
      continue;
    }
    const amount = Math.min(card.balanceCents ?? 0, remaining);
    if (amount <= 0) {
      rejected.push({ code: card.code, reason: "This gift card has no balance left." });
      continue;
    }
    applied.push({ code: card.code, kind: card.kind, label: label(card), amountCents: amount });
    remaining -= amount;
    giftCardCents += amount;
  }

  return { applied, discountCents, giftCardCents, totalCents: remaining, rejected };
}
