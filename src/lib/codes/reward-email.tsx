import "server-only";
import { render, toPlainText } from "@react-email/render";
import { privateSite } from "@config/private.server";
import { FirstOrderCoupon } from "@/emails/FirstOrderCoupon";
import type { OrderEmailData } from "@/lib/email/data";
import type { OutgoingEmail } from "@/lib/email/transport";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { formatCardNumber } from "./apply";

/** Builds the first-order thank-you coupon email for this order and coupon. */
export async function buildRewardEmail(d: OrderEmailData, codeId: string): Promise<OutgoingEmail | null> {
  const c = await db.promoCode.findUnique({ where: { id: codeId } });
  if (!c) return null;
  const base = (process.env.APP_URL ?? "https://coastlineprints.ca").replace(/\/$/, "");
  const amount = money(c.amountCents ?? 0);
  const useBy = (c.expiresAt ?? new Date()).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Vancouver" });
  const html = await render(
    <FirstOrderCoupon firstName={d.customerName.split(/\s+/)[0]} amount={amount} number={formatCardNumber(c.code)} useBy={useBy} saved={!!c.ownerId} orderUrl={`${base}/order`} redeemUrl={`${base}/redeem`} />,
  );
  return { to: d.customerEmail, replyTo: privateSite.ownerEmail, subject: `Thanks for your first order! Here's ${amount} off your next one`, html, text: toPlainText(html) };
}
