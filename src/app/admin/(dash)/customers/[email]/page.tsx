import Link from "next/link";
import { notFound } from "next/navigation";
import { printReceiptAction } from "@/app/admin/actions";
import { adjustPointsAction, inviteCustomerAction } from "@/app/admin/tools-actions";
import { PrintButton } from "@/components/admin/PrintButton";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { field, Field, ToolForm } from "@/components/admin/ToolForm";
import { Card } from "@/components/ui/Card";
import { walletFor } from "@/lib/account/wallet";
import { requireAdmin } from "@/lib/admin/auth";
import { listCustomers } from "@/lib/admin/customers";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { rewardsSummary } from "@/lib/rewards/server";

export const metadata = { title: "Customer" };

const day = (d: Date) => d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Vancouver" });

/** One customer: their orders (with invoices and ticket reprints), points, wallet, and account. */
export default async function CustomerPage({ params }: { params: Promise<{ email: string }> }) {
  await requireAdmin();
  const email = decodeURIComponent((await params).email).toLowerCase();
  const row = (await listCustomers(email)).find((r) => r.email === email);
  if (!row) notFound();
  const [orders, points, wallet] = await Promise.all([
    db.order.findMany({ where: { customerEmail: email }, orderBy: { createdAt: "desc" }, include: { items: { select: { fileName: true, quantity: true } } } }),
    rewardsSummary(email),
    row.account ? walletFor(row.account.id) : Promise.resolve([]),
  ]);
  const phone = orders[0]?.customerPhone;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/customers" className="text-sm text-muted hover:text-fg">
          ← Customers
        </Link>
        <h1 className="mt-1 font-display text-3xl font-bold">{row.name || email}</h1>
        <p className="text-sm text-muted">
          <a href={`mailto:${email}`} className="hover:text-fg hover:underline">
            {email}
          </a>
          {phone && (
            <>
              {" · "}
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:text-fg hover:underline">
                {phone}
              </a>
            </>
          )}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Orders", String(row.orders)],
          ["Spent on prints", money(row.spentCents)],
          ["Points", String(points.balance)],
          ["Account", row.account ? (row.account.lastSeenAt ? `Last in ${day(row.account.lastSeenAt)}` : row.account.invitedAt ? "Invited, not signed in yet" : "Yes") : "None"],
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <dt className="text-xs text-faint">{k}</dt>
            <dd className="mt-1 font-display text-lg font-bold">{v}</dd>
          </Card>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Orders</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm font-semibold text-accent-text hover:underline">
                      {o.orderNumber}
                    </Link>
                    <span className="ml-2 text-sm text-muted">
                      {day(o.createdAt)} · {money(o.totalCents)}
                    </span>
                    <p className="truncate text-xs text-faint">{o.items.map((i) => `${i.fileName} × ${i.quantity}`).join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={o.status} fulfillment={o.fulfillment} />
                    <a href={`/orders/${o.viewToken}/invoice/pdf`} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-accent-line hover:text-fg">
                      Invoice
                    </a>
                    <PrintButton action={printReceiptAction} name="orderId" value={o.id} label={`Print ticket for ${o.orderNumber}`} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-accent-line hover:text-fg">
                      Print ticket
                    </PrintButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {!row.account && (
            <Card className="p-5">
              <h2 className="font-display text-lg font-semibold">No account yet</h2>
              <p className="mt-1 text-sm text-muted">Make one for them: they get an email saying how to sign in, and their past orders and points show up straight away.</p>
              <ToolForm action={inviteCustomerAction} submit="Invite them" pending="Sending…" className="mt-4">
                <input type="hidden" name="email" value={email} />
                <input type="hidden" name="name" value={row.name} />
              </ToolForm>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold">Points</h2>
            <p className="mt-1 text-sm text-muted">
              {points.balance} now{points.pending ? `, ${points.pending} on the way` : ""}. Give some as a thank-you, or fix a mistake.
            </p>
            <ToolForm action={adjustPointsAction} submit="Save" className="mt-4">
              <input type="hidden" name="email" value={email} />
              <Field label="Points to add (use a minus to take away)">
                <input name="points" type="number" step={1} required placeholder="100" className={field} />
              </Field>
            </ToolForm>
            {points.history.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {points.history.slice(0, 8).map((h) => (
                  <li key={h.id} className="flex justify-between gap-3">
                    <span className="truncate text-muted">{h.label}</span>
                    <span className={`font-mono ${h.points > 0 ? "text-success" : "text-muted"}`}>
                      {h.points > 0 ? "+" : ""}
                      {h.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {wallet.length > 0 && (
            <Card className="p-5">
              <h2 className="font-display text-lg font-semibold">Wallet</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {wallet.map((w) => (
                  <li key={w.code} className="flex justify-between gap-3">
                    <span className="truncate">{w.title}</span>
                    <span className={w.usable ? "text-success" : "text-faint"}>{w.usable ? "Ready" : "Used"}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
