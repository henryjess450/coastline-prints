import Link from "next/link";
import { pickup } from "@config/pickup";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/admin/auth";
import { getEffectiveConfig } from "@/lib/config/effective";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { formatPickup } from "@/lib/pickup";
import { ORDER_STATUSES } from "@/lib/orders/status";
import { cn } from "@/lib/cn";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Orders" };

const PAGE = 50;

type Search = { status?: string; printer?: string; q?: string; page?: string };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const cfg = await getEffectiveConfig();
  const status = sp.status ?? "ACTIVE";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.OrderWhereInput = {};
  if (status === "ACTIVE") where.status = { not: "PICKED_UP" };
  else if (ORDER_STATUSES.some((s) => s.id === status)) where.status = status;
  else if (status === "EMAIL_FAILED") {
    const failed = await db.outboxJob.findMany({ where: { status: "FAILED" }, select: { dedupeKey: true } });
    where.id = { in: failed.map((j) => j.dedupeKey?.split(":")[0] ?? "").filter(Boolean) };
  }
  if (sp.printer) where.items = { some: { printerId: sp.printer } };
  if (sp.q?.trim()) {
    const q = sp.q.trim();
    where.OR = [{ orderNumber: { contains: q.toUpperCase() } }, { customerName: { contains: q } }, { customerEmail: { contains: q.toLowerCase() } }];
  }

  const [orders, total, counts] = await Promise.all([
    db.order.findMany({ where, include: { items: { select: { quantity: true, printerName: true, printerId: true } } }, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const activeCount = counts.filter((c) => c.status !== "PICKED_UP").reduce((n, c) => n + c._count, 0);

  const tabs = [{ id: "ACTIVE", label: "Active", n: activeCount }, ...ORDER_STATUSES.map((s) => ({ id: s.id, label: s.label, n: countOf(s.id) })), { id: "ALL", label: "All", n: counts.reduce((n, c) => n + c._count, 0) }];
  const href = (over: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { status, printer: sp.printer, q: sp.q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin?${p}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Orders</h1>
        <form className="flex gap-2" action="/admin">
          <input type="hidden" name="status" value={status} />
          {sp.printer && <input type="hidden" name="printer" value={sp.printer} />}
          <input name="q" defaultValue={sp.q} placeholder="Order #, name or email" aria-label="Search orders" className="h-10 w-56 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-accent-line" />
        </form>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {tabs.map((t) => (
          <Link key={t.id} href={href({ status: t.id, page: undefined })} role="tab" aria-selected={status === t.id} className={cn("rounded-full border px-3 py-1 text-sm transition-colors", status === t.id ? "border-accent-line bg-accent text-accent-ink" : "border-line text-muted hover:text-fg")}>
            {t.label} <span className="opacity-70">{t.n}</span>
          </Link>
        ))}
        {status === "EMAIL_FAILED" && <span className="rounded-full border border-danger bg-danger/15 px-3 py-1 text-sm text-danger">Orders with failed emails</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 text-sm">
        <span className="py-1 text-faint">Printer:</span>
        {[{ id: undefined, name: "Any" }, ...cfg.printers.map((p) => ({ id: p.id, name: p.shortName }))].map((p) => (
          <Link key={p.id ?? "any"} href={href({ printer: p.id, page: undefined })} className={cn("rounded-full border px-3 py-1", sp.printer === p.id ? "border-accent-line bg-accent-soft text-fg" : "border-line text-muted hover:text-fg")}>
            {p.name}
          </Link>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        {orders.length === 0 ? (
          <p className="p-8 text-center text-muted">No orders here yet.</p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Pickup</th>
                <th className="px-4 py-3 font-medium">Printers</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => {
                const pieces = o.items.reduce((n, i) => n + i.quantity, 0);
                const printers = [...new Set(o.items.map((i) => i.printerName.replace(/^(Bambu Lab|Elegoo) /, "")))].join(", ");
                return (
                  <tr key={o.id} className="transition-colors hover:bg-surface-strong">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono font-semibold text-accent-text hover:underline">
                        {o.orderNumber}
                      </Link>
                      <div className="text-xs text-faint">{o.createdAt.toLocaleDateString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: pickup.timeZone })}</div>
                    </td>
                    <td className="px-4 py-3">
                      {o.customerName}
                      <div className="text-xs text-faint">{pieces} piece{pieces === 1 ? "" : "s"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatPickup(o.pickupDate, o.pickupTime, pickup) ?? "Not booked"}</td>
                    <td className="px-4 py-3 text-muted">{printers}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(o.totalCents)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {total > PAGE && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            {(page - 1) * PAGE + 1} to {Math.min(page * PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            {page > 1 && <Link href={href({ page: String(page - 1) })} className="underline">Newer</Link>}
            {page * PAGE < total && <Link href={href({ page: String(page + 1) })} className="underline">Older</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
