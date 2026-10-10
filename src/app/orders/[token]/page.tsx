import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pickup } from "@config/pickup";
import { privateSite } from "@config/private.server";
import { site } from "@config/site";
import { Reveal } from "@/components/home/Reveal";
import { Celebration } from "@/components/motion/Celebration";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { db } from "@/lib/db";
import { hours, money } from "@/lib/format";
import { formatPickup } from "@/lib/pickup";
import { orderSpend, pointsFor } from "@/lib/rewards/server";
import type { AppliedCode } from "@/lib/codes/apply";
import { trackingUrl } from "@/lib/orders/status";
import { isTracked, shippingAddressLines, shippingSummary } from "@/lib/shipping/address";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Private confirmation page, reached via an unguessable link (also emailed
 * with the receipt). This and the emails are the only places the pickup
 * address appears, and only for pickup orders.
 */
export default async function OrderConfirmationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{20,64}$/.test(token)) notFound();
  const order = await db.order.findUnique({ where: { viewToken: token }, include: { items: true } });
  if (!order) notFound();

  const firstName = order.customerName.split(/\s+/)[0];
  const pickupWhen = formatPickup(order.pickupDate, order.pickupTime, pickup);
  const statusHref = `/status?order=${encodeURIComponent(order.orderNumber)}`;
  const shipTo = shippingAddressLines(order);
  const tracked = isTracked(order);
  const steps = shipTo
    ? ["We check your files and queue them on the right printer.", "Your parts are printed and cleaned up.", "We pack them and send them with Canada Post.", tracked ? "You get an email with your tracking number." : "You get an email when it's in the mail."]
    : ["We check your files and queue them on the right printer.", "Your parts are printed and cleaned up.", "You get a “ready for pickup” email.", "Collect your order at your pickup time."];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-12 sm:px-6 sm:pt-16">
      <div className="text-center">
        <Celebration />
        <h1 className="mt-8 font-display text-3xl font-bold tracking-tight sm:text-4xl">Thanks, {firstName}! Your order is in.</h1>
        <p className="mt-3 text-muted">
          Order <span className="font-mono font-semibold text-fg">{order.orderNumber}</span> · paid {money(order.totalCents)} CAD
        </p>
        <p className="mt-1 text-sm text-faint">A receipt is on its way to {order.customerEmail}.</p>
        {pointsFor(orderSpend(order)) > 0 && (
          <p className="mt-3 text-sm">
            You&apos;ll earn <strong className="text-accent-text">{pointsFor(orderSpend(order))} reward points</strong> when {shipTo ? "it arrives" : "you pick it up"}.{" "}
            <Link href="/rewards" className="text-accent-text underline underline-offset-4">
              See prizes
            </Link>
          </p>
        )}
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {shipTo ? (
          <Card flat highlight className="p-6 sm:p-8">
            <h2 className="font-display text-lg font-semibold">Shipping</h2>
            <p className="mt-2 text-sm text-muted">{shippingSummary(order)}. {tracked ? "We'll email you the tracking number when it ships." : "Lettermail has no tracking; we'll email you when it's in the mail."}</p>
            <address className="mt-3 rounded-xl bg-accent-soft px-4 py-3 not-italic">
              <span className="block text-xs text-faint">Shipping to</span>
              {shipTo.map((l, i) => (
                <span key={i} className={i ? "block text-fg" : "block font-semibold text-fg"}>
                  {l}
                </span>
              ))}
            </address>
            {order.trackingNumber && (
              <a href={trackingUrl(order.trackingNumber)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-mono text-sm text-accent-text underline underline-offset-4">
                Track {order.trackingNumber}
              </a>
            )}
            <p className="mt-2 text-xs text-faint">Something wrong with the address? Reply to your receipt email before it ships.</p>
          </Card>
        ) : (
        <Card flat highlight className="p-6 sm:p-8">
          <h2 className="font-display text-lg font-semibold">Pickup</h2>
          <p className="mt-2 text-sm text-muted">{site.fulfillmentLabel}. We&apos;ll email you when your order is ready, before your pickup time.</p>
          {pickupWhen && (
            <div className="mt-3 rounded-xl bg-accent-soft px-4 py-3">
              <span className="block text-xs text-faint">Your pickup time</span>
              <span className="font-semibold text-fg">{pickupWhen}</span>
            </div>
          )}
          <address className="mt-2 rounded-xl bg-accent-soft px-4 py-3 not-italic">
            <span className="block text-xs text-faint">Pickup address</span>
            <span className="font-semibold text-fg">{privateSite.pickupAddress}</span>
          </address>
          <p className="mt-2 text-xs text-faint">Please keep this address private. Need a different time? Reply to your receipt email.</p>
        </Card>
        )}

        <Card flat className="p-6 sm:p-8">
          <h2 className="font-display text-lg font-semibold">What happens next</h2>
          <ol className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
            {steps.map((t, i) => (
              <Reveal as="li" key={t} className="flex gap-3" delay={0.5 + i * 0.1}>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">{i + 1}</span>
                {t}
              </Reveal>
            ))}
          </ol>
        </Card>
      </div>

      <Card flat className="mt-6 p-6 sm:p-8">
        <h2 className="font-display text-lg font-semibold">Your order</h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {it.fileName} <span className="text-faint">× {it.quantity}</span>
                </p>
                <p className="text-xs text-muted">
                  {it.material} · {it.colorName} · {it.sizeX.toFixed(0)}×{it.sizeY.toFixed(0)}×{it.sizeZ.toFixed(0)} mm · {it.printerName} · about {hours(it.hoursEach * it.quantity)}
                </p>
              </div>
              <span className="shrink-0 font-mono">{money(it.lineCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
          <Row label="Order fee" value={money(order.baseFeeCents)} />
          {order.minimumAdjCents > 0 && <Row label="Minimum order top-up" value={money(order.minimumAdjCents)} />}
          {shipTo && <Row label="Shipping" value={money(order.shippingCents)} />}
          {(JSON.parse(order.appliedCodes) as AppliedCode[]).map((a) => (
            <Row key={a.code} label={a.label} value={`−${money(a.amountCents)}`} />
          ))}
          {order.etransferDiscountCents > 0 && <Row label="e-Transfer discount" value={`−${money(order.etransferDiscountCents)}`} />}
          <Row label="Total paid (CAD)" value={money(order.totalCents)} strong />
          {order.cardLast4 && <Row label="Paid with" value={`${formatBrand(order.cardBrand)} •••• ${order.cardLast4}`} />}
          {order.paymentMethod === "ETRANSFER" && <Row label="Paid with" value="Interac e-Transfer" />}
        </dl>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <a href={`/orders/${order.viewToken}/invoice`} className="font-medium text-accent-text underline underline-offset-4">
            View invoice
          </a>
          <a href={`/orders/${order.viewToken}/invoice/pdf`} className="text-accent-text underline underline-offset-4">
            Download PDF
          </a>
          {order.receiptUrl && (
            <a href={order.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-accent-text underline underline-offset-4">
              Square receipt
            </a>
          )}
        </div>
      </Card>

      <div className="mt-12 flex flex-wrap justify-center gap-4">
        <ButtonLink href={statusHref}>Track this order</ButtonLink>
        <ButtonLink href="/order" variant="secondary">
          Start another order
        </ButtonLink>
      </div>
      <p className="mt-8 text-center text-xs text-faint">
        Bookmark this page to see these details again. Questions? See the <Link href="/terms" className="underline">Terms</Link> or reply to your receipt email.
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between font-semibold" : "flex justify-between text-muted"}>
      <dt>{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

function formatBrand(brand: string | null) {
  if (!brand) return "Card";
  return brand
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
