import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/admin/auth";
import { adminClock } from "@/lib/admin/cards";
import { touchDetail, type Touch } from "@/lib/attribution";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

export const metadata = { title: "Sources" };

const RANGES = [
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "365", label: "A year", days: 365 },
];

type Row = { name: string; orders: number; newCustomers: number; cents: number; gifts: number; giftCents: number };

/**
 * Where orders and gift card sales come from: Google, Instagram, ads, AI
 * assistants, email, direct... Read from the cp_src cookies at checkout
 * (lib/attribution.ts). Orders from before tracking started aren't counted.
 */
export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const wanted = (await searchParams).range;
  const range = RANGES.find((r) => r.id === wanted) ?? RANGES[0];
  const { now } = adminClock();
  const since = new Date(now.getTime() - range.days * 86_400_000);
  const [orders, gifts, recent] = await Promise.all([
    db.order.findMany({ where: { createdAt: { gte: since }, source: { not: null } }, select: { source: true, firstSource: true, totalCents: true, giftCardCents: true, customerOrderCount: true } }),
    db.giftPurchase.findMany({ where: { status: "PAID", paidAt: { gte: since }, source: { not: null } }, select: { source: true, amountCents: true } }),
    db.order.findMany({ where: { source: { not: null } }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, orderNumber: true, source: true, sourceDetail: true, totalCents: true, giftCardCents: true, createdAt: true } }),
  ]);

  const rows = new Map<string, Row>();
  const row = (name: string) => rows.get(name) ?? (rows.set(name, { name, orders: 0, newCustomers: 0, cents: 0, gifts: 0, giftCents: 0 }), rows.get(name)!);
  for (const o of orders) {
    const r = row(o.source!);
    r.orders++;
    // What the customer spent, including any gift card they used.
    r.cents += o.totalCents + o.giftCardCents;
    if (o.customerOrderCount === 1) r.newCustomers++;
  }
  for (const g of gifts) {
    const r = row(g.source!);
    r.gifts++;
    r.giftCents += g.amountCents;
  }
  const list = [...rows.values()].sort((a, b) => b.cents + b.giftCents - (a.cents + a.giftCents));
  const total = list.reduce((n, r) => n + r.cents + r.giftCents, 0);

  // How first-time customers first found the shop (even if they came back another way to buy).
  const found = new Map<string, number>();
  for (const o of orders) if (o.customerOrderCount === 1) found.set(o.firstSource ?? o.source!, (found.get(o.firstSource ?? o.source!) ?? 0) + 1);
  const foundList = [...found.entries()].sort((a, b) => b[1] - a[1]);

  const day = (d: Date) => d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Vancouver" });
  const detail = (raw: string | null) => {
    try {
      return touchDetail((JSON.parse(raw ?? "{}") as { last: Touch | null }).last);
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Sources</h1>
          <p className="text-sm text-muted">Where orders and gift card sales came from: the last outside link someone used before buying.</p>
        </div>
        <nav aria-label="Range" className="flex gap-1 rounded-full border border-line bg-surface p-1 text-sm">
          {RANGES.map((r) => (
            <Link key={r.id} href={`/admin/sources?range=${r.id}`} className={cn("rounded-full px-3 py-1.5 font-medium", r.id === range.id ? "bg-accent text-accent-ink" : "text-muted hover:text-fg")}>
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      <Card className="overflow-x-auto p-5 sm:p-6">
        {list.length ? (
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                <th className="py-2 pr-4 font-medium">Source</th>
                <th className="py-2 pr-4 text-right font-medium">Orders</th>
                <th className="py-2 pr-4 text-right font-medium">New customers</th>
                <th className="py-2 pr-4 text-right font-medium">Order sales</th>
                <th className="py-2 pr-4 text-right font-medium">Gift cards</th>
                <th className="py-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const share = total ? (r.cents + r.giftCents) / total : 0;
                return (
                  <tr key={r.name} className="border-b border-line/60">
                    <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                      {r.name}
                    </th>
                    <td className="py-2.5 pr-4 text-right font-mono">{r.orders}</td>
                    <td className="py-2.5 pr-4 text-right font-mono">{r.newCustomers}</td>
                    <td className="py-2.5 pr-4 text-right font-mono">{money(r.cents)}</td>
                    <td className="py-2.5 pr-4 text-right font-mono">{r.gifts ? `${r.gifts} · ${money(r.giftCents)}` : "–"}</td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-16 overflow-hidden rounded-full bg-surface-strong">
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(share * 100)}%` }} />
                        </span>
                        <span className="w-9 font-mono text-xs">{Math.round(share * 100)}%</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">No tracked sales in this range yet. Sources are recorded from now on, so give it a few orders.</p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold">How new customers first found you</h2>
          <p className="mt-1 text-sm text-muted">Their very first visit from outside, even if they came back another way to buy.</p>
          {foundList.length ? (
            <ul className="mt-4 space-y-2 text-sm">
              {foundList.map(([name, n]) => (
                <li key={name} className="flex justify-between">
                  <span>{name}</span>
                  <span className="font-mono">{n}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-faint">No first-time customers in this range yet.</p>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold">Latest orders</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {recent.map((o) => (
              <li key={o.id}>
                <div className="flex justify-between gap-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-mono text-accent-text hover:underline">
                    {o.orderNumber}
                  </Link>
                  <span className="text-muted">
                    {o.source} · {money(o.totalCents + o.giftCardCents)} · {day(o.createdAt)}
                  </span>
                </div>
                <p className="truncate text-xs text-faint">{detail(o.sourceDetail)}</p>
              </li>
            ))}
            {!recent.length && <li className="text-faint">Nothing yet.</li>}
          </ul>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Tag your links</h2>
        <p className="mt-1 text-sm text-muted">Add these to links you share, so they show up by name here instead of as &ldquo;Direct&rdquo; or &ldquo;Other websites&rdquo;.</p>
        <ul className="mt-4 space-y-2 break-all font-mono text-xs">
          <li>Instagram bio: coastlineprints.ca/?utm_source=instagram&amp;utm_medium=bio</li>
          <li>Instagram post or story: coastlineprints.ca/christmas-gifts?utm_source=instagram&amp;utm_medium=social&amp;utm_campaign=christmas</li>
          <li>Google Business Profile website: coastlineprints.ca/?utm_source=google&amp;utm_medium=maps</li>
          <li>Flyer or market sign (QR code): coastlineprints.ca/?utm_source=flyer&amp;utm_campaign=market</li>
          <li>Google Ads (auto-tagged): turn on auto-tagging and clicks show as Google Ads</li>
        </ul>
      </Card>
    </div>
  );
}
