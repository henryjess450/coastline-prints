import Link from "next/link";
import { pickup } from "@config/pickup";
import { SeaPage } from "@/components/account/sea/SeaPage";
import { SeaSection } from "@/components/account/sea/SeaSection";
import { AdminHero } from "@/components/admin/today/AdminHero";
import { AllCaughtUp } from "@/components/admin/today/AllCaughtUp";
import { TaskGroup } from "@/components/admin/today/TaskGroup";
import { adminCards, adminClock } from "@/lib/admin/cards";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

export const metadata = { title: "Today" };

/**
 * The admin home: what needs doing, in plain words, most urgent first, each
 * with a one-tap button for the next step. Sits on the sea like the account page.
 */
export default async function TodayPage() {
  const { now, weekAgo } = adminClock();
  const [cards, etransfers, failedEmails, week] = await Promise.all([
    adminCards({ status: { not: "PICKED_UP" } }),
    db.etransferDeposit.count({ where: { status: "REVIEW" } }),
    db.outboxJob.count({ where: { status: "FAILED" } }),
    db.order.aggregate({ where: { createdAt: { gte: weekAgo } }, _count: true, _sum: { totalCents: true, giftCardCents: true, shippingCents: true } }),
  ]);
  const of = (status: string, ship?: boolean) => cards.filter((c) => c.status === status && (ship == null || (c.fulfillment === "SHIP") === ship));

  const handover = of("READY_FOR_PICKUP", false).filter((c) => c.due === "late" || c.due === "today");
  const toShip = of("POST_PROCESSING", true);
  const cleanup = of("POST_PROCESSING", false);
  const fresh = of("PAID");
  const queued = of("QUEUED");
  const printing = of("PRINTING");
  const todo = handover.length + toShip.length + cleanup.length + fresh.length + queued.length + etransfers + failedEmails;

  const hour = Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hourCycle: "h23", timeZone: pickup.timeZone }).format(now));
  const hello = hour < 12 ? "Good morning!" : hour < 18 ? "Good afternoon!" : "Good evening!";
  const date = now.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: pickup.timeZone });
  // Print sales: what was paid, gift cards included, shipping left out (it's passed on at cost).
  const sales = (week._sum.totalCents ?? 0) + (week._sum.giftCardCents ?? 0) - (week._sum.shippingCents ?? 0);

  return (
    // Full width, out of the admin's centred column, so the sea runs edge to edge.
    <div className="relative left-1/2 w-screen -translate-x-1/2">
      <SeaPage
        hero={
          <AdminHero
            hello={hello}
            date={date}
            todo={todo}
            stats={[
              { label: "Orders this week", value: String(week._count) },
              { label: "Print sales this week", value: money(sales) },
              { label: "On the go", value: String(cards.length) },
            ]}
          />
        }
      >
        <div className="mx-auto max-w-6xl px-4 pb-32 pt-12 sm:px-6">
          <SeaSection id="todo" label="Needs you" title={todo ? "Your to-do list" : "Nothing to do"} intro={todo ? "Most urgent first. Tap the button on a card to move it along." : undefined}>
            {(etransfers > 0 || failedEmails > 0) && (
              <div className="mb-10 flex flex-wrap gap-3">
                {etransfers > 0 && (
                  <Link href="/admin/etransfers" className="rounded-full bg-warning/20 px-4 py-2 text-sm font-semibold text-warning hover:bg-warning/30">
                    {etransfers === 1 ? "1 e-Transfer needs a look" : `${etransfers} e-Transfers need a look`} →
                  </Link>
                )}
                {failedEmails > 0 && (
                  <Link href="/admin/orders?view=list&status=EMAIL_FAILED" className="rounded-full bg-danger/15 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/25">
                    {failedEmails === 1 ? "1 email didn't send" : `${failedEmails} emails didn't send`} →
                  </Link>
                )}
              </div>
            )}
            {todo === 0 ? (
              <AllCaughtUp />
            ) : (
              <>
                <TaskGroup title="Pickups today" hint="Hand these over, then tap Picked up." cards={handover} />
                <TaskGroup title="Pack and ship" hint="Print the label, pack it up, then mark it shipped. The customer is emailed." cards={toShip} />
                <TaskGroup title="Clean up" hint="Take off the supports and tidy them up. Ready for pickup emails the customer." cards={cleanup} />
                <TaskGroup title="New orders" hint="Check the files look printable, then queue them." cards={fresh} showPrint />
                <TaskGroup title="Ready to print" hint="Start them on the printer shown." cards={queued} showPrint />
              </>
            )}
          </SeaSection>

          {printing.length > 0 && (
            <SeaSection id="printing" label="On the printers" title={printing.length === 1 ? "1 print running" : `${printing.length} prints running`} intro="Tap Done printing when they come off the bed.">
              <TaskGroup cards={printing} showPrint />
            </SeaSection>
          )}

          <SeaSection id="all" label="Everything else" title="All orders">
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/orders" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">
                Open the board
              </Link>
              <Link href="/admin/orders?view=list&status=ALL" className="rounded-full border border-[var(--sea-wake)]/30 px-5 py-2.5 text-sm font-semibold hover:border-accent-line">
                Search past orders
              </Link>
            </div>
          </SeaSection>
        </div>
      </SeaPage>
    </div>
  );
}
