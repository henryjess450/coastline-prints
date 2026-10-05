import Link from "next/link";
import { pickup } from "@config/pickup";
import { printCodeAction, toggleCodeAction } from "@/app/admin/actions";
import { CreateCodeForm } from "@/components/admin/CreateCodeForm";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/admin/auth";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { formatCardNumber } from "@/lib/codes/apply";

export const metadata = { title: "Codes" };

const date = (d: Date) => d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: pickup.timeZone });

export default async function CodesPage() {
  await requireAdmin();
  const codes = await db.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { redemptions: { where: { status: "USED" }, include: { checkout: { select: { order: { select: { id: true, orderNumber: true } } } } }, orderBy: { createdAt: "desc" }, take: 5 } },
  });
  const now = new Date();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Coupons and gift cards</h1>
      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Create a code</h2>
        <CreateCodeForm />
      </Card>

      <Card className="overflow-x-auto p-0">
        {codes.length === 0 ? (
          <p className="p-8 text-center text-muted">No codes yet.</p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Used / balance</th>
                <th className="px-4 py-3 font-medium">Limits</th>
                <th className="px-4 py-3 font-medium">Recent orders</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {codes.map((c) => {
                const expired = !!c.expiresAt && c.expiresAt <= now;
                const usedUp = c.kind === "GIFT_CARD" ? (c.balanceCents ?? 0) <= 0 : c.maxUses != null && c.uses >= c.maxUses;
                const state = !c.active ? "Off" : expired ? "Expired" : usedUp ? (c.kind === "GIFT_CARD" ? "Spent" : "Used up") : "Active";
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <code className="whitespace-nowrap font-mono font-semibold">{formatCardNumber(c.code)}</code>
                      {c.pin && <div className="font-mono text-xs text-muted">PIN {c.pin}</div>}
                      {c.note && <div className="text-xs text-faint">{c.note}</div>}
                    </td>
                    <td className="px-4 py-3">{c.kind === "PERCENT" ? `${c.percentOff}% off` : c.kind === "AMOUNT" ? `${money(c.amountCents ?? 0)} off` : `${money(c.initialCents ?? 0)} gift card`}</td>
                    <td className="px-4 py-3 font-mono">{c.kind === "GIFT_CARD" ? `${money(c.balanceCents ?? 0)} left` : `${c.uses}${c.maxUses != null ? ` / ${c.maxUses}` : ""} used`}</td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {c.minOrderCents > 0 && <div>Min order {money(c.minOrderCents)}</div>}
                      <div>{c.expiresAt ? `Expires ${date(c.expiresAt)}` : "No expiry"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.redemptions.length === 0
                        ? <span className="text-faint">None yet</span>
                        : c.redemptions.map((r) =>
                            r.checkout.order ? (
                              <Link key={r.id} href={`/admin/orders/${r.checkout.order.id}`} className="mr-2 font-mono text-accent-text hover:underline">
                                {r.checkout.order.orderNumber}
                              </Link>
                            ) : null,
                          )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", state === "Active" ? "bg-success/20 text-success" : "bg-surface-strong text-muted")}>{state}</span>
                        <form action={printCodeAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="rounded-full border border-line px-2.5 py-0.5 text-xs hover:border-accent-line">Print</button>
                        </form>
                        <a href={`/api/admin/codes/${c.id}/slip`} target="_blank" className="text-xs text-accent-text hover:underline">
                          View
                        </a>
                        <form action={toggleCodeAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline">{c.active ? "Turn off" : "Turn on"}</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
