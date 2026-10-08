import Link from "next/link";
import { etransfer as cfg } from "@config/payments";
import { pickup } from "@config/pickup";
import { ignoreDepositAction } from "@/app/admin/actions";
import { ConfirmEtransfer } from "@/components/admin/ConfirmEtransfer";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { etransferSettings } from "@/lib/payments/etransfer.server";

export const metadata = { title: "e-Transfers" };

const when = (d: Date) => d.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: pickup.timeZone });

export default async function EtransfersPage() {
  await requireAdmin();
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const [review, waiting, recent, recentExpired] = await Promise.all([
    db.etransferDeposit.findMany({ where: { status: "REVIEW" }, orderBy: { receivedAt: "desc" } }),
    db.checkout.findMany({ where: { paymentMethod: "ETRANSFER", status: "PENDING" }, orderBy: { createdAt: "desc" } }),
    db.etransferDeposit.findMany({ where: { status: { in: ["MATCHED", "IGNORED"] } }, orderBy: { receivedAt: "desc" }, take: 20, include: { checkout: { select: { etransferCode: true, order: { select: { id: true, orderNumber: true } } } } } }),
    db.checkout.findMany({ where: { paymentMethod: "ETRANSFER", status: "FAILED", createdAt: { gt: since } }, orderBy: { createdAt: "desc" } }),
  ]);
  const choices = [...waiting, ...recentExpired].map((c) => ({ id: c.id, label: `${c.etransferCode} · ${money(c.totalCents)} · ${c.customerName}${c.status === "FAILED" ? " (expired)" : ""}` }));
  const set = !!etransferSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">e-Transfers</h1>
        <p className="mt-1 text-sm text-muted">
          {set
            ? `The inbox is checked every minute while someone's waiting. Deposits with the right code (or the only waiting order of that exact amount) confirm on their own. Unpaid orders cancel after ${cfg.payWindowMinutes / 60} h.`
            : "e-Transfer isn't set up yet: add the ETRANSFER_ settings to .env (see SETUP.md)."}
        </p>
      </div>

      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold">Needs you ({review.length})</h2>
        {review.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing to check.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {review.map((d) => {
              const guess = choices.find((c) => waiting.some((w) => w.id === c.id && w.totalCents === d.amountCents))?.id;
              return (
                <li key={d.id} className="rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-lg font-semibold">
                      {money(d.amountCents)} <span className="font-normal text-muted">from {d.senderName ?? "unknown"}</span>
                    </p>
                    <span className="text-xs text-faint">{when(d.receivedAt)}</span>
                  </div>
                  <p className="mt-1 text-muted">
                    Message: <span className="text-fg">{d.memo ?? "(none)"}</span>
                    {d.reference && <span className="ml-2 font-mono text-xs text-faint">Ref {d.reference}</span>}
                  </p>
                  <p className="mt-1 text-warning">{d.note}</p>
                  {!d.verified && <p className="mt-1 text-xs text-danger">Not signed by Interac. Check your Scotiabank account before confirming.</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <ConfirmEtransfer depositId={d.id} choices={choices} suggested={guess} label="Confirm payment" />
                    <form action={ignoreDepositAction}>
                      <input type="hidden" name="depositId" value={d.id} />
                      <button className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:border-accent-line hover:text-fg">Not an order</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold">Waiting to be paid ({waiting.length})</h2>
        {waiting.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No one is waiting.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line text-sm">
            {waiting.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p>
                    <span className="font-mono font-semibold">{c.etransferCode}</span> · {money(c.totalCents)} · {c.customerName}
                  </p>
                  <p className="text-xs text-faint">
                    {c.customerEmail} · placed {when(c.createdAt)} · cancels {c.expiresAt ? when(c.expiresAt) : "soon"}
                  </p>
                </div>
                <ConfirmEtransfer checkoutId={c.id} label="Mark received" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold">Recent deposits</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line text-sm">
            {recent.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p>
                    {money(d.amountCents)} from {d.senderName ?? "unknown"} <span className="text-faint">· {d.memo ?? "no message"}</span>
                  </p>
                  <p className="text-xs text-faint">
                    {when(d.receivedAt)}
                    {d.note ? ` · ${d.note}` : ""}
                  </p>
                </div>
                {d.checkout?.order ? (
                  <Link href={`/admin/orders/${d.checkout.order.id}`} className="font-mono text-accent-text hover:underline">
                    {d.checkout.order.orderNumber}
                  </Link>
                ) : (
                  <span className="text-xs text-faint">{d.status === "IGNORED" ? "Not an order" : ""}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
