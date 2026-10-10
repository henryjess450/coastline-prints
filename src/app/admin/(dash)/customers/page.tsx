import Link from "next/link";
import { inviteCustomerAction } from "@/app/admin/tools-actions";
import { area, field, Field, ToolForm } from "@/components/admin/ToolForm";
import { requireAdmin } from "@/lib/admin/auth";
import { listCustomers } from "@/lib/admin/customers";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Customers" };

const day = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Vancouver" }) : "Never");

/** Everyone who has ordered or has an account: search, open one, or invite someone new. */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const rows = await listCustomers(q);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Customers</h1>
          <p className="text-sm text-muted">{rows.length === 1 ? "1 person" : `${rows.length} people`} who have ordered or have an account.</p>
        </div>
        <form action="/admin/customers" className="w-full sm:w-auto">
          <input name="q" defaultValue={q} placeholder="Name or email" aria-label="Search customers" className="h-11 w-full rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-accent-line sm:w-64" />
        </form>
      </div>

      <details className="group rounded-3xl border border-line bg-surface p-5 open:pb-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-lg font-semibold">
          Invite someone
          <span className="text-sm font-normal text-accent-text group-open:hidden">Set up an account and email them</span>
        </summary>
        <ToolForm action={inviteCustomerAction} submit="Make the account and email them" pending="Sending…" className="mt-5 max-w-xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <input name="email" type="email" required className={field} />
            </Field>
            <Field label="Name (optional)">
              <input name="name" className={field} />
            </Field>
          </div>
          <Field label="A note from you (optional)" hint="Shown at the top of their welcome email.">
            <textarea name="note" rows={2} maxLength={500} className={area} />
          </Field>
        </ToolForm>
      </details>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <li key={r.email}>
            <Link href={`/admin/customers/${encodeURIComponent(r.email)}`} className="block h-full rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent-line">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.name || r.email.split("@")[0]}</p>
                  <p className="truncate text-sm text-muted">{r.email}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", r.account ? (r.account.invitedAt && !r.account.lastSeenAt ? "bg-sand/20 text-sand" : "bg-success/15 text-success") : "bg-surface-strong text-muted")}>
                  {r.account ? (r.account.invitedAt && !r.account.lastSeenAt ? "Invited" : "Account") : "No account"}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-faint">Orders</dt>
                  <dd className="font-semibold tabular-nums">{r.orders}</dd>
                </div>
                <div>
                  <dt className="text-xs text-faint">Spent</dt>
                  <dd className="font-semibold tabular-nums">{money(r.spentCents)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-faint">Points</dt>
                  <dd className="font-semibold tabular-nums">{r.points}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-faint">Last order: {day(r.lastOrderAt)}</p>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="p-8 text-center text-muted md:col-span-2 xl:col-span-3">No one matches that.</li>}
      </ul>
    </div>
  );
}
