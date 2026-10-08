import Link from "next/link";
import { pickup } from "@config/pickup";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/admin/auth";
import { getEffectiveConfig } from "@/lib/config/effective";
import { db } from "@/lib/db";
import { hours } from "@/lib/format";
import { addDays, formatPickup, todayIn } from "@/lib/pickup";
import { cn } from "@/lib/cn";

export const metadata = { title: "Printer queues" };

/** Orders still waiting on a printer. */
const ON_PRINTER = ["PAID", "QUEUED", "PRINTING"];

export default async function QueuesPage() {
  await requireAdmin();
  const cfg = await getEffectiveConfig();
  const items = await db.orderItem.findMany({
    where: { order: { status: { in: ON_PRINTER } } },
    include: { order: { select: { id: true, orderNumber: true, status: true, pickupDate: true, pickupTime: true, customerName: true, fulfillment: true } } },
  });
  // Soonest pickup first; unbooked last.
  items.sort((a, b) => `${a.order.pickupDate ?? "9999"}${a.order.pickupTime ?? ""}`.localeCompare(`${b.order.pickupDate ?? "9999"}${b.order.pickupTime ?? ""}`));
  const soon = addDays(todayIn(pickup.timeZone), 2);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-bold">Printer queues</h1>
      <p className="text-sm text-muted">Paid, queued and printing orders, soonest pickup first. Pickups within 2 days are highlighted.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        {cfg.printers.map((p) => {
          const list = items.filter((i) => i.printerId === p.id);
          const total = list.reduce((h, i) => h + i.hoursEach * i.quantity, 0);
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl font-bold">{p.name}</h2>
                <span className="text-sm text-muted">
                  {list.length === 0 ? "Empty" : `${list.length} job${list.length === 1 ? "" : "s"} · about ${hours(total)}`}
                </span>
              </div>
              <p className="text-xs text-faint">
                {p.buildVolume.x} × {p.buildVolume.y} × {p.buildVolume.z} mm · {p.materials.join(", ")}
              </p>
              {list.length === 0 ? (
                <p className="mt-6 text-center text-sm text-muted">Nothing waiting. Nice.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {list.map((i) => {
                    const urgent = !!i.order.pickupDate && i.order.pickupDate <= soon;
                    return (
                      <li key={i.id}>
                        <Link href={`/admin/orders/${i.order.id}`} className={cn("block rounded-2xl border p-3 transition-colors hover:border-accent-line", urgent ? "border-warning/60 bg-warning/10" : "border-line bg-surface")}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-semibold text-accent-text">{i.order.orderNumber}</span>
                            <StatusBadge status={i.order.status} />
                          </div>
                          <p className="mt-1 truncate text-sm">
                            {i.fileName} × {i.quantity} · {i.material} {i.colorName}
                          </p>
                          <p className="text-xs text-muted">
                            {i.sizeX.toFixed(0)}×{i.sizeY.toFixed(0)}×{i.sizeZ.toFixed(0)} mm · {i.quality} · about {hours(i.hoursEach * i.quantity)} · {i.order.fulfillment === "SHIP" ? "shipping" : `pickup ${formatPickup(i.order.pickupDate, i.order.pickupTime, pickup) ?? "not booked"}`}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
