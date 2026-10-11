import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GiftReveal } from "@/components/gifts/GiftReveal";
import { formatCardNumber } from "@/lib/codes/apply";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { designOf } from "@/lib/giftcards/designs";
import { friendlyDate } from "@/lib/giftcards/rules";

export const metadata: Metadata = { title: "Your gift", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The recipient opens their gift card here, from the button in their email.
 * The link is a long random token, as private as the email itself. A gift
 * scheduled for later stays wrapped until its day.
 */
export default async function GiftPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();
  const p = await db.giftPurchase.findUnique({ where: { revealToken: token }, include: { code: true } });
  if (!p || p.status !== "PAID" || !p.code) notFound();

  if (p.deliverAt > new Date()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">No peeking!</h1>
        <p className="mt-4 text-muted">This gift opens {p.sendOn ? `on ${friendlyDate(p.sendOn)}` : "soon"}.</p>
      </div>
    );
  }

  const design = designOf(p.design);
  return (
    <GiftReveal
      orderHref="/order"
      gift={{
        design,
        amount: money(p.amountCents + p.bonusCents),
        number: formatCardNumber(p.code.code),
        pin: p.code.pin ?? "",
        recipientFirst: p.recipientName.trim().split(/\s+/)[0],
        buyerName: p.buyerName,
        message: p.message,
      }}
    />
  );
}
