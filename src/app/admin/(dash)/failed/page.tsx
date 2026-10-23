import Link from "next/link";
import { pickup } from "@config/pickup";
import { dismissJobAction, failedJobsBulkAction, retryJobAction } from "@/app/admin/actions";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Didn't send" };

/** What each background job is, in plain words. */
const LABELS: Record<string, string> = {
  "customer-receipt": "Receipt email to customer",
  "owner-new-order": "New-order email to you",
  "ready-for-pickup": "Ready-for-pickup email",
  shipped: "Shipped email",
  "status-update": "Status update email",
  "discord-new-order": "Discord message",
  "order-receipt": "Printed receipt",
  "code-slip": "Printed coupon or gift card slip",
  "scan-stub": "Printed scan stub",
  "customer-sync": "Square customer sync",
  "account-sync": "Square customer sync",
  "account-update": "Square customer update",
  broadcast: "Promotion email",
  "account-invite": "Account invite email",
  "lightlab-stock-alert": "Low stock alert",
  "lightlab-back-in-stock": "Back-in-stock email",
  "review-request": "Review request email",
  "etransfer-instructions": "e-Transfer instructions email",
  "first-order-coupon": "First-order coupon email",
};

const when = (d: Date) => d.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: pickup.timeZone });

/**
 * Every background job that gave up: emails, receipt prints, Discord, Square
 * syncs. Retry sends it again; Dismiss hides it for good (it won't be sent).
 */
export default async function FailedJobsPage() {
  await requireAdmin();
  const jobs = await db.outboxJob.findMany({ where: { status: "FAILED" }, orderBy: { createdAt: "desc" }, take: 200 });
  const ids = (key: "orderId" | "customerId") => [...new Set(jobs.map((j) => (JSON.parse(j.payload) as Record<string, string | undefined>)[key]).filter((v): v is string => !!v))];
  const [orders, customers] = await Promise.all([
    db.order.findMany({ where: { id: { in: ids("orderId") } }, select: { id: true, orderNumber: true, customerName: true } }),
    db.customer.findMany({ where: { id: { in: ids("customerId") } }, select: { id: true, email: true } }),
  ]);
  const orderOf = new Map(orders.map((o) => [o.id, o]));
  const emailOf = new Map(customers.map((c) => [c.id, c.email]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Didn&apos;t send</h1>
          <p className="text-sm text-muted">Emails, receipt prints and messages that failed after every retry. Retry once the problem is fixed, or dismiss ones you don&apos;t need.</p>
        </div>
        {jobs.length > 0 && (
          <div className="flex gap-2">
            <form action={failedJobsBulkAction}>
              <input type="hidden" name="what" value="retry" />
              <button className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-accent-line">Retry all</button>
            </form>
            <form action={failedJobsBulkAction}>
              <input type="hidden" name="what" value="dismiss" />
              <button className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-danger hover:text-danger">Dismiss all</button>
            </form>
          </div>
        )}
      </div>

      {jobs.length === 0 ? (
        <Card className="p-8 text-center text-muted">Everything sent. Nothing to fix.</Card>
      ) : (
        <ul className="space-y-3">
          {jobs.map((j) => {
            const p = JSON.parse(j.payload) as Record<string, string | undefined>;
            const order = p.orderId ? orderOf.get(p.orderId) : undefined;
            const email = p.customerId ? emailOf.get(p.customerId) : undefined;
            return (
              <li key={j.id}>
                <Card className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">{LABELS[j.template] ?? `${j.kind} ${j.template}`}</p>
                    <p className="text-muted">
                      {order ? (
                        <Link href={`/admin/orders/${order.id}`} className="font-mono text-accent-text hover:underline">
                          {order.orderNumber}
                        </Link>
                      ) : null}
                      {order ? ` · ${order.customerName} · ` : email ? `${email} · ` : ""}
                      {when(j.createdAt)} · {j.attempts} {j.attempts === 1 ? "try" : "tries"}
                    </p>
                    {j.lastError && <p className="break-words text-xs text-danger">{j.lastError.slice(0, 240)}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={retryJobAction}>
                      <input type="hidden" name="jobId" value={j.id} />
                      <button className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent-line">Retry</button>
                    </form>
                    <form action={dismissJobAction}>
                      <input type="hidden" name="jobId" value={j.id} />
                      <button className="rounded-full border border-line px-3 py-1 text-xs hover:border-danger hover:text-danger">Dismiss</button>
                    </form>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
