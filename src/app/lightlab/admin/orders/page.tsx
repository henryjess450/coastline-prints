import Link from "next/link";
import { pickup } from "@config/pickup";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

export const metadata = { title: "Orders" };

/** Orders with LightLab products in them. Each one opens in the Coastline admin, where it's packed and marked ready. */
export default async function LightLabOrdersPage() {
  const orders = await db.order.findMany({
    where: { items: { some: { productId: { not: null } } } },
    include: { items: { where: { productId: { not: null } }, select: { fileName: true, colorName: true, quantity: true, lineCents: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const open = orders.filter((o) => o.status !== "PICKED_UP");
  const revenue = orders.reduce((s, o) => s + o.items.reduce((t, i) => t + i.lineCents, 0), 0);
  const units = orders.reduce((s, o) => s + o.items.reduce((t, i) => t + i.quantity, 0), 0);

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 gap-3">
        <Stat label="To fill" value={String(open.length)} />
        <Stat label="Lamps sold" value={String(units)} />
        <Stat label="Product sales" value={money(revenue)} />
      </dl>
      {orders.length === 0 ? (
        <p className="rounded-3xl border border-line bg-surface px-6 py-16 text-center text-muted">No LightLab orders yet.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent-line">
                <span className="font-mono text-sm font-semibold">{o.orderNumber}</span>
                <StatusBadge status={o.status} fulfillment={o.fulfillment} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {o.items.map((i) => `${i.fileName}${i.colorName ? ` (${i.colorName})` : ""} × ${i.quantity}`).join(", ")}
                </span>
                <span className="text-sm text-muted">{o.customerName}</span>
                <span className="text-xs text-faint">{o.createdAt.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: pickup.timeZone })}</span>
                <span className="font-mono text-sm">{money(o.totalCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
