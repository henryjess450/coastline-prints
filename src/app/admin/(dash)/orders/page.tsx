import Link from "next/link";
import { SeaPage } from "@/components/account/sea/SeaPage";
import { SeaSection } from "@/components/account/sea/SeaSection";
import { Board } from "@/components/admin/Board";
import { adminCards, adminClock } from "@/lib/admin/cards";
import { BOARD } from "@/lib/orders/next-step";
import { pickup } from "@config/pickup";
import { PrintButton } from "@/components/admin/PrintButton";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AnimatedCount } from "@/components/motion/AnimatedCount";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/admin/auth";
import { getEffectiveConfig } from "@/lib/config/effective";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { formatPickup } from "@/lib/pickup";
import { printReceiptAction } from "@/app/admin/actions";
import { ORDER_STATUSES } from "@/lib/orders/status";
import { cn } from "@/lib/cn";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Orders" };

const PAGE = 50;

/** These tabs hold both pickup and shipped orders. */
const TAB_LABELS: Record<string, string> = { READY_FOR_PICKUP: "Ready / shipped", PICKED_UP: "Picked up / delivered" };

type Search = { status?: string; printer?: string; q?: string; page?: string; view?: string };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  if (sp.view !== "list") return <BoardPage />;
  const cfg = await getEffectiveConfig();
  const status = sp.status ?? "ACTIVE";
  const page = Math.max(1, Number(sp.page) || 1);

  // Archived orders only show on their own tab.
  const where: Prisma.OrderWhereInput = { archivedAt: status === "ARCHIVED" ? { not: null } : null };
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

  const [orders, total, counts, archived] = await Promise.all([
    db.order.findMany({ where, include: { items: { select: { quantity: true, printerName: true, printerId: true } } }, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: { archivedAt: null }, _count: true }),
    db.order.count({ where: { archivedAt: { not: null } } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const activeCount = counts.filter((c) => c.status !== "PICKED_UP").reduce((n, c) => n + c._count, 0);

  const tabs = [{ id: "ACTIVE", label: "Active", n: activeCount }, ...ORDER_STATUSES.map((s) => ({ id: s.id, label: TAB_LABELS[s.id] ?? s.label, n: countOf(s.id) })), { id: "ALL", label: "All", n: counts.reduce((n, c) => n + c._count, 0) }, { id: "ARCHIVED", label: "Archived", n: archived }];
  const href = (over: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { view: "list", status, printer: sp.printer, q: sp.q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/orders?${p}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-display text-3xl font-bold">Orders</h1>
          <ViewToggle view="list" />
        </div>
        <form className="flex w-full gap-2 sm:w-auto" action="/admin/orders">
          <input type="hidden" name="view" value="list" />
          <input type="hidden" name="status" value={status} />
          {sp.printer && <input type="hidden" name="printer" value={sp.printer} />}
          <input name="q" defaultValue={sp.q} placeholder="Order #, name or email" aria-label="Search orders" className="h-11 w-full rounded-full border sm:w-56 border-line bg-surface px-4 text-sm outline-none focus:border-accent-line" />
        </form>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {tabs.map((t) => (
          <Link key={t.id} href={href({ status: t.id, page: undefined })} role="tab" aria-selected={status === t.id} className={cn("rounded-full border px-3 py-1 text-sm transition-colors", status === t.id ? "border-accent-line bg-accent text-accent-ink" : "border-line text-muted hover:text-fg")}>
            {t.label} <AnimatedCount value={t.n} className="opacity-70" />
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

      {/* Phones: one row per order, no sideways scrolling */}
      <ul className="space-y-3 md:hidden">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/orders/${o.id}`} className="block rounded-2xl border border-line bg-surface p-4 active:scale-[0.99]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm font-semibold text-accent-text">{o.orderNumber}</span>
                <StatusBadge status={o.status} fulfillment={o.fulfillment} />
              </div>
              <p className="mt-1 font-semibold">{o.customerName}</p>
              <p className="text-sm text-muted">
                {money(o.totalCents)} · {o.fulfillment === "SHIP" ? `Ship to ${o.shipCity}, ${o.shipProvince}` : (formatPickup(o.pickupDate, o.pickupTime, pickup) ?? "Pickup not booked")}
              </p>
            </Link>
          </li>
        ))}
        {orders.length === 0 && <li className="p-8 text-center text-muted">No orders here yet.</li>}
      </ul>

      <Card className="hidden overflow-x-auto p-0 md:block">
        {orders.length === 0 ? (
          <p className="p-8 text-center text-muted">No orders here yet.</p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Pickup / ship</th>
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
                      {o.customerOrderCount > 1 && <span className="ml-2 rounded-full bg-sand/20 px-2 py-0.5 text-[11px] font-semibold text-sand">★ Returning</span>}
                      <div className="text-xs text-faint">{pieces} piece{pieces === 1 ? "" : "s"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted">{o.fulfillment === "SHIP" ? `Ship to ${o.shipCity}, ${o.shipProvince}` : (formatPickup(o.pickupDate, o.pickupTime, pickup) ?? "Not booked")}</td>
                    <td className="px-4 py-3 text-muted">{printers}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(o.totalCents)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.status} fulfillment={o.fulfillment} />
                        <PrintButton action={printReceiptAction} name="orderId" value={o.id} label={`Reprint ticket for ${o.orderNumber}`} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:border-accent-line hover:text-fg">
                          Reprint
                        </PrintButton>
                      </div>
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

/** Board or list. */
function ViewToggle({ view }: { view: "board" | "list" }) {
  return (
    <div className="flex rounded-full border border-line bg-surface p-1 text-sm">
      {(["board", "list"] as const).map((v) => (
        <Link key={v} href={v === "board" ? "/admin/orders" : "/admin/orders?view=list"} className={cn("rounded-full px-4 py-1.5 font-medium capitalize", view === v ? "bg-accent text-accent-ink" : "text-muted hover:text-fg")}>
          {v}
        </Link>
      ))}
    </div>
  );
}

/** Every open order as a card, in a column for where it's at; plus what finished this week. */
async function BoardPage() {
  const { weekAgo } = adminClock();
  const cards = await adminCards({ OR: [{ status: { not: "PICKED_UP" } }, { status: "PICKED_UP", updatedAt: { gte: weekAgo } }] });
  const columns = BOARD.map((col) => ({ id: col.id, title: col.title, cards: cards.filter((c) => (col.statuses as readonly string[]).includes(c.status)) }));
  const open = cards.filter((c) => c.status !== "PICKED_UP").length;
  return (
    // Full width, out of the admin's centred column, so the sea runs edge to edge.
    <div className="relative left-1/2 w-screen -translate-x-1/2">
      <SeaPage
        hero={
          <section className="mx-auto max-w-7xl px-4 pb-8 pt-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="font-display text-4xl font-bold tracking-tight">Orders</h1>
              <ViewToggle view="board" />
            </div>
            <p className="mt-2 text-muted">{open === 1 ? "1 order on the go." : `${open} orders on the go.`} Tap the button on a card to move it to the next column.</p>
          </section>
        }
      >
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6">
          <SeaSection id="board" label="Board" title="From file to pickup">
            <Board columns={columns} />
          </SeaSection>
        </div>
      </SeaPage>
    </div>
  );
}
