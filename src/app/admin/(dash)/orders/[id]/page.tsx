import Link from "next/link";
import { notFound } from "next/navigation";
import { pickup } from "@config/pickup";
import { printReceiptAction, retryJobAction } from "@/app/admin/actions";
import { PrintButton } from "@/components/admin/PrintButton";
import { OrderItems, type AdminItem } from "@/components/admin/OrderItems";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { NextStepButton } from "@/components/admin/NextStepButton";
import { OrderHousekeeping } from "@/components/admin/OrderHousekeeping";
import { StatusControl } from "@/components/admin/StatusControl";
import { nextStep } from "@/lib/orders/next-step";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/admin/auth";
import { getEffectiveConfig } from "@/lib/config/effective";
import { db } from "@/lib/db";
import { money, returningLabel } from "@/lib/format";
import { formatPickup } from "@/lib/pickup";
import type { AppliedCode } from "@/lib/codes/apply";
import { statusInfo, trackingUrl } from "@/lib/orders/status";
import type { ColorSlot } from "@/lib/model/colors";
import { isTracked, shippingAddressLines, shippingBoxesOf } from "@/lib/shipping/address";
import { packageName } from "@/lib/shipping/pack";

export const metadata = { title: "Order" };

const when = (d: Date) => d.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: pickup.timeZone });

const jobLabel: Record<string, string> = {
  "customer-receipt": "Receipt to customer",
  "owner-new-order": "New-order email to you",
  "ready-for-pickup": "Ready-for-pickup email",
  shipped: "Shipped email",
  "status-update": "Status update email",
  "discord-new-order": "Discord message",
  "order-receipt": "Printed receipt",
};

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { items: { include: { upload: { select: { fileDeletedAt: true } } } }, events: { orderBy: { createdAt: "desc" } } } });
  if (!order) notFound();
  const [cfg, jobs] = await Promise.all([getEffectiveConfig(), db.outboxJob.findMany({ where: { dedupeKey: { startsWith: `${order.id}:` } }, orderBy: { createdAt: "asc" } })]);

  const items: AdminItem[] = order.items.map((it) => {
    const mat = cfg.materials.find((m) => m.id === it.material);
    const color = mat?.colors.find((c) => c.id === it.colorId) ?? { id: it.colorId, name: it.colorName, hex: "#888888", finish: "solid" as const, available: true };
    const printer = cfg.printers.find((p) => p.id === it.printerId);
    return {
      id: it.id,
      uploadId: it.uploadId,
      fileName: it.fileName,
      quantity: it.quantity,
      material: it.material,
      colorName: it.colorName,
      quality: it.quality,
      infill: it.infill,
      printerName: it.printerName,
      gramsEach: it.gramsEach,
      hoursEach: it.hoursEach,
      lineCents: it.lineCents,
      rotated: it.orientation !== 0,
      scale: { x: it.scaleX * it.unitFactor, y: it.scaleY * it.unitFactor, z: it.scaleZ * it.unitFactor },
      orientation: it.orientation,
      size: { x: it.sizeX, y: it.sizeY, z: it.sizeZ },
      color,
      buildVolume: printer?.buildVolume ?? null,
      fileDeleted: !!it.upload.fileDeletedAt,
      colorSlots: it.colorSlots ? (JSON.parse(it.colorSlots) as ColorSlot[]) : null,
    };
  });

  const next = nextStep(order.status, order.fulfillment, isTracked(order));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/orders" className="text-sm text-muted hover:text-fg">
            ← Orders
          </Link>
          <h1 className="mt-1 flex items-center gap-3 font-display text-3xl font-bold">
            <span className="font-mono">{order.orderNumber}</span> <StatusBadge status={order.status} fulfillment={order.fulfillment} className="text-sm" />
            {order.archivedAt && <span className="rounded-full bg-surface-strong px-2.5 py-0.5 text-sm font-semibold text-muted">Archived</span>}
          </h1>
          <p className="text-sm text-muted">
            Placed {when(order.createdAt)} · {money(order.totalCents)} paid
          </p>
        </div>
      </div>

      <Card className="p-5">
        {next ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-faint">Next step</p>
              <p className="font-display text-xl font-bold">{next.label}</p>
            </div>
            <NextStepButton key={order.status} orderId={order.id} from={order.status} step={next} customer={order.customerName.trim().split(/\s+/)[0] || "them"} size="lg" className="sm:w-72" />
          </div>
        ) : (
          <p className="font-display text-xl font-bold">All done. This order has been collected.</p>
        )}
        <details className="group mt-5 border-t border-line pt-4">
          <summary className="cursor-pointer list-none text-sm text-muted hover:text-fg">
            <span className="inline-block transition-transform group-open:rotate-90">›</span> Jump to any step, add a note or email the customer
          </summary>
          <div className="mt-4">
            <StatusControl key={order.status} orderId={order.id} current={order.status} fulfillment={order.fulfillment} trackingNumber={order.trackingNumber} tracked={isTracked(order)} />
          </div>
        </details>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Items" className="min-w-0">
          <OrderItems items={items} />
        </section>

        <aside className="space-y-4">
          <Card className="p-5 text-sm">
            <h2 className="mb-3 font-display text-lg font-semibold">Customer</h2>
            <p className="font-medium">{order.customerName}</p>
            {returningLabel(order.customerOrderCount) && (
              <Link href={`/admin/orders?view=list&q=${encodeURIComponent(order.customerEmail)}&status=ALL`} className="mb-1 inline-block rounded-full bg-sand/20 px-2.5 py-0.5 text-xs font-semibold text-sand hover:underline">
                ★ {returningLabel(order.customerOrderCount)}
              </Link>
            )}
            <p>
              <a className="text-accent-text hover:underline" href={`mailto:${order.customerEmail}?subject=${encodeURIComponent(`Your order ${order.orderNumber}`)}`}>
                {order.customerEmail}
              </a>
            </p>
            <p>
              <a className="text-accent-text hover:underline" href={`tel:${order.customerPhone.replace(/[^\d+]/g, "")}`}>
                {order.customerPhone}
              </a>
            </p>
            {order.fulfillment === "SHIP" ? (
              <>
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-faint">Ship to</h3>
                <address className="select-all font-medium not-italic">
                  {shippingAddressLines(order)?.map((l) => (
                    <span key={l} className="block">
                      {l}
                    </span>
                  ))}
                </address>
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-faint">Pack in</h3>
                <ul className="space-y-0.5">
                  {shippingBoxesOf(order).map((b, i) => (
                    <li key={i}>
                      <span className="font-medium">{packageName(b)}</span>{" "}
                      <span className="text-muted">
                        · {b.pieces} {b.pieces === 1 ? "piece" : "pieces"}
                      </span>
                    </li>
                  ))}
                </ul>
                {order.trackingNumber && (
                  <a href={trackingUrl(order.trackingNumber)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-mono text-accent-text hover:underline">
                    {order.trackingNumber}
                  </a>
                )}
              </>
            ) : (
              <>
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-faint">Pickup</h3>
                <p className="font-medium">{formatPickup(order.pickupDate, order.pickupTime, pickup) ?? "Not booked"}</p>
              </>
            )}
            {order.notes && (
              <>
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-faint">Notes</h3>
                <p className="whitespace-pre-wrap rounded-xl bg-accent-soft p-3">{order.notes}</p>
              </>
            )}
          </Card>

          <Card className="p-5 text-sm">
            <h2 className="mb-3 font-display text-lg font-semibold">Payment</h2>
            <dl className="space-y-1">
              <Row label="Items" value={money(order.subtotalCents)} />
              <Row label="Order fee" value={money(order.baseFeeCents)} />
              {order.minimumAdjCents > 0 && <Row label="Minimum top-up" value={money(order.minimumAdjCents)} />}
              {order.fulfillment === "SHIP" && <Row label="Shipping" value={money(order.shippingCents)} />}
              {(JSON.parse(order.appliedCodes) as AppliedCode[]).map((a) => (
                <Row key={a.code} label={a.kind === "GIFT_CARD" ? `Gift card ${a.code}` : a.label} value={`−${money(a.amountCents)}`} />
              ))}
              {order.etransferDiscountCents > 0 && <Row label="e-Transfer discount" value={`−${money(order.etransferDiscountCents)}`} />}
              <Row label="Total paid" value={money(order.totalCents)} strong />
              {order.cardLast4 && <Row label="Card" value={`${order.cardBrand ?? "Card"} •••• ${order.cardLast4}`} />}
              {order.paymentMethod === "ETRANSFER" && <Row label="Paid by" value="Interac e-Transfer" />}
            </dl>
            <p className="mt-2 break-all font-mono text-xs text-faint">{order.squarePaymentId.startsWith("nopay_")
                ? "No card payment (covered by gift card)"
                : order.paymentMethod === "ETRANSFER"
                  ? order.squarePaymentId.startsWith("etr_manual_")
                    ? "e-Transfer marked received by you"
                    : "e-Transfer matched from the deposit email"
                  : `Square payment ${order.squarePaymentId}`}</p>
            {order.squareCustomerId ? (
              <a href={`https://app.squareup.com/dashboard/customers/directory/customer/${order.squareCustomerId}`} target="_blank" rel="noopener noreferrer" className="mt-1 block text-accent-text hover:underline">
                Customer in Square
              </a>
            ) : (
              <p className="mt-1 text-xs text-faint">Not linked to a Square customer yet (retrying in the background).</p>
            )}
            {order.receiptUrl && (
              <a href={order.receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-accent-text hover:underline">
                Square receipt
              </a>
            )}
          </Card>

          <Card className="p-5 text-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Emails and receipt</h2>
              <a href={`/api/admin/orders/${order.id}/receipt`} target="_blank" className="text-xs text-accent-text hover:underline">
                View receipt
              </a>
            </div>
            <ul className="space-y-2">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-start justify-between gap-2">
                  <div>
                    <p>{jobLabel[j.template] ?? j.template}</p>
                    <p className="text-xs text-faint">
                      {j.status === "SENT" ? `Sent ${j.sentAt ? when(j.sentAt) : ""}` : j.status === "FAILED" ? "Failed" : j.attempts ? `Retrying (try ${j.attempts})` : "Queued"}
                    </p>
                    {j.status !== "SENT" && j.lastError && <p className="text-xs text-danger">{j.lastError.slice(0, 140)}</p>}
                  </div>
                  {j.status === "FAILED" && (
                    <form action={retryJobAction}>
                      <input type="hidden" name="jobId" value={j.id} />
                      <button className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent-line">Retry</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <PrintButton action={printReceiptAction} name="orderId" value={order.id} className="w-full rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-accent-line">
                {process.env.RECEIPT_PRINTER_HOST ? "Print receipt" : "Print receipt (printer not set up)"}
              </PrintButton>
            </div>
          </Card>

          <Card className="p-5 text-sm">
            <h2 className="mb-3 font-display text-lg font-semibold">History</h2>
            <ol className="space-y-3 border-l border-line pl-4">
              {order.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent-line" aria-hidden />
                  <p className="font-medium">{statusInfo(e.toStatus, order.fulfillment).label}</p>
                  <p className="text-xs text-faint">
                    {when(e.createdAt)}
                    {e.customerNotified ? " · customer emailed" : ""}
                  </p>
                  {e.note && <p className="mt-1 text-xs text-muted">“{e.note}”</p>}
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Archive or delete</h2>
        <OrderHousekeeping orderId={order.id} orderNumber={order.orderNumber} archived={!!order.archivedAt} />
      </Card>
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
