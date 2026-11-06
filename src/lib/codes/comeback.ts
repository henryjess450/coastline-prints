import "server-only";
import { db } from "@/lib/db";
import { getPrintSettings } from "@/lib/receipt/settings";
import { generateCode } from "./server";

/*
 * "Come back" coupons: one per LightLab stand receipt, printed on the bottom.
 * A percent off the next visit, one use, and only at the market stand
 * register (PromoCode.marketOnly). Each remembers the market it came from,
 * so the Receipts page can show which markets bring people back.
 */

export type ComebackCoupon = { code: string; percent: number; expiresAt: Date };

/** The order's come-back coupon, made the first time its receipt prints. Null when they're switched off. */
export async function comebackCouponFor(orderId: string): Promise<ComebackCoupon | null> {
  const { comeback } = await getPrintSettings();
  const existing = await db.promoCode.findUnique({ where: { comebackOrderId: orderId } });
  if (existing) return { code: existing.code, percent: existing.percentOff ?? comeback.percent, expiresAt: existing.expiresAt! };
  if (!comeback.on) return null;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, source: true } });
  if (!order) return null;

  let code = generateCode("PERCENT");
  for (let i = 0; i < 5 && (await db.promoCode.findUnique({ where: { code } })); i++) code = generateCode("PERCENT");
  const expiresAt = new Date(Date.now() + comeback.days * 86_400_000);
  try {
    await db.promoCode.create({
      data: {
        code,
        kind: "PERCENT",
        percentOff: comeback.percent,
        maxUses: 1,
        expiresAt,
        marketOnly: true,
        comebackOrderId: orderId,
        issuedMarket: order.source,
        note: `Come back coupon on ${order.orderNumber}${order.source ? ` (${order.source})` : ""}`,
      },
    });
  } catch {
    // Printed twice at once: use the one that won.
    const won = await db.promoCode.findUnique({ where: { comebackOrderId: orderId } });
    if (!won) throw new Error("Couldn't make the come back coupon");
    return { code: won.code, percent: won.percentOff ?? comeback.percent, expiresAt: won.expiresAt! };
  }
  return { code, percent: comeback.percent, expiresAt };
}

/** For the Receipts page: per market, how many were handed out and how many came back. */
export async function comebackStats() {
  const rows = await db.promoCode.findMany({ where: { comebackOrderId: { not: null } }, select: { issuedMarket: true, uses: true } });
  const by = new Map<string, { market: string; printed: number; used: number }>();
  for (const r of rows) {
    const key = r.issuedMarket || "No market picked";
    const s = by.get(key) ?? { market: key, printed: 0, used: 0 };
    s.printed++;
    if (r.uses > 0) s.used++;
    by.set(key, s);
  }
  return [...by.values()].sort((a, b) => b.printed - a.printed);
}
