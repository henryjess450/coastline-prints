import type { Metadata } from "next";
import Link from "next/link";
import { pickup } from "@config/pickup";
import { invite, prizes } from "@config/rewards";
import { AccountHero } from "@/components/account/fun/AccountHero";
import { SignInScreen } from "@/components/account/fun/SignInScreen";
import { WelcomeBurst } from "@/components/account/fun/WelcomeBurst";
import { RedeemForm } from "@/components/account/RedeemForm";
import { InviteFriend } from "@/components/account/sea/InviteFriend";
import { HappeningNow, NowSwitch, NowTitle, type ActiveOrder } from "@/components/account/sea/HappeningNow";
import { OrderLog } from "@/components/account/sea/OrderLog";
import { getEffectiveConfig } from "@/lib/config/effective";
import { PointsLine } from "@/components/account/sea/PointsLine";
import { SeaPage } from "@/components/account/sea/SeaPage";
import { SeaSection } from "@/components/account/sea/SeaSection";
import { SignOutButton } from "@/components/account/SignOutButton";
import { Wallet } from "@/components/account/Wallet";
import { currentCustomer } from "@/lib/account/auth";
import { firstName, profileFor } from "@/lib/account/profile";
import { walletFor } from "@/lib/account/wallet";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { orderStatuses, statusIndex, statusInfo, trackingUrl } from "@/lib/orders/status";
import { formatPickup } from "@/lib/pickup";
import { inviteCodeFor, inviteStats } from "@/lib/rewards/invite";
import { rewardsSummary } from "@/lib/rewards/server";
import { isTracked } from "@/lib/shipping/address";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

/** What each stage says, as the headline of an order in progress. */
const HEADLINES: Record<string, { pickup: string; ship: string }> = {
  PAID: { pickup: "We've got your order", ship: "We've got your order" },
  QUEUED: { pickup: "Waiting for a printer", ship: "Waiting for a printer" },
  PRINTING: { pickup: "Printing now", ship: "Printing now" },
  POST_PROCESSING: { pickup: "Cleaning up your prints", ship: "Cleaning up your prints" },
  READY_FOR_PICKUP: { pickup: "Ready for pickup", ship: "On its way to you" },
};

export default async function AccountPage() {
  const customer = await currentCustomer();
  if (!customer)
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
        <SignInScreen intro="Sign in to see your gift cards, coupons, reward points and orders. Saved cards are ready to tap at checkout." />
      </div>
    );

  const [items, points, orders, profile, cfg, inviteCode, invited] = await Promise.all([
    walletFor(customer.id),
    rewardsSummary(customer.email),
    db.order.findMany({ where: { customerEmail: customer.email }, orderBy: { createdAt: "desc" }, take: 30, include: { items: { select: { uploadId: true, fileName: true, quantity: true, material: true, colorId: true, colorName: true, sizeX: true, sizeY: true, sizeZ: true, upload: { select: { fileDeletedAt: true } } } } } }),
    profileFor(customer),
    getEffectiveConfig(),
    inviteCodeFor(customer),
    inviteStats(customer.email),
  ]);
  const friendOff = invite.friendCents % 100 ? money(invite.friendCents) : `$${invite.friendCents / 100}`;
  // Greet them by their saved (or latest order's) first name, or the start of their email.
  const name = firstName(profile);

  const active: ActiveOrder[] = orders
    .filter((o) => o.status !== "PICKED_UP")
    .map((o) => {
      const ship = o.fulfillment === "SHIP";
      const info = statusInfo(o.status, o.fulfillment);
      return {
        orderNumber: o.orderNumber,
        viewToken: o.viewToken,
        headline: HEADLINES[o.status]?.[ship ? "ship" : "pickup"] ?? info.label,
        detail: info.customer,
        stages: orderStatuses(o.fulfillment).map((s) => s.label),
        at: statusIndex(o.status),
        items: o.items.map((i) => `${i.fileName} × ${i.quantity} · ${i.material} ${i.colorName}`),
        when: ship
          ? { kind: "ship" as const, place: `${o.shipCity}, ${o.shipProvince}`, tracking: o.trackingNumber ? { number: o.trackingNumber, url: trackingUrl(o.trackingNumber) } : null, tracked: isTracked(o) }
          : { kind: "pickup" as const, label: formatPickup(o.pickupDate, o.pickupTime, pickup), calendarHref: o.pickupDate && o.pickupTime ? `/orders/${o.viewToken}/calendar` : null },
      };
    });

  return (
    <SeaPage
      hero={
        <AccountHero name={name} email={customer.email}>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/account/settings" className="group btn btn-secondary h-10 gap-2 px-4 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-500 group-hover:rotate-90" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
              Settings
            </Link>
            <SignOutButton />
          </div>
        </AccountHero>
      }
    >
      <WelcomeBurst />
      <div className="mx-auto max-w-5xl px-4 pb-40 pt-16 sm:px-6">
        {active.length > 0 && (
          <NowSwitch count={active.length}>
            <SeaSection id="now" label="Happening now" title={<NowTitle />}>
              <HappeningNow orders={active} />
            </SeaSection>
          </NowSwitch>
        )}

        <SeaSection id="points" label="Coastline Rewards" title="Your points" intro="Earn 2 points for every dollar on prints, added when your order is picked up or delivered. Tap a prize to trade for it.">
          <PointsLine
            balance={points.balance}
            pending={points.pending}
            prizes={prizes.map((p) => ({ id: p.id, points: p.points, title: p.title, blurb: p.blurb, kind: p.kind, value: money(p.kind === "order-fee" ? cfg.pricing.baseFeeCents : (p.valueCents ?? 0)) }))}
            history={points.history}
          />
        </SeaSection>

        <SeaSection
          id="invite"
          label="Invite a friend"
          title={`Give ${friendOff}, get ${invite.points} points`}
          intro={`Share your code. Your friend gets ${friendOff} off their first order, and you get ${invite.points} points as soon as they place it.`}
        >
          <InviteFriend code={inviteCode.code} offer={friendOff} friends={invited.friends} points={invited.points} />
        </SeaSection>

        <SeaSection id="wallet" label="Wallet" title="Gift cards and coupons" intro="Locked to your account, so only you can spend them. Tap a gift card to flip it over.">
          <Wallet items={items} />
          <div className="mt-12 max-w-2xl">
            <h3 className="font-display text-lg font-semibold">Add one</h3>
            <p className="mt-1 text-sm text-muted">Got a gift card or coupon? Save it here and it&apos;s ready at checkout.</p>
            <div className="mt-4">
              <RedeemForm />
            </div>
          </div>
        </SeaSection>

        <SeaSection id="orders" label="Log" title="Your orders">
          {orders.length ? (
            <OrderLog
              orders={orders.map((o) => {
                const info = statusInfo(o.status, o.fulfillment);
                return {
                  orderNumber: o.orderNumber,
                  viewToken: o.viewToken,
                  date: o.createdAt.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: pickup.timeZone }),
                  total: money(o.totalCents),
                  statusLabel: info.label,
                  done: o.status === "PICKED_UP",
                  summary: o.items.map((i) => (i.quantity > 1 ? `${i.fileName} × ${i.quantity}` : i.fileName)).join(", "),
                  canReorder: o.items.some((i) => !i.upload.fileDeletedAt),
                };
              })}
            />
          ) : (
            <p className="text-muted">
              No orders with this email yet.{" "}
              <Link href="/order" className="text-accent-text underline underline-offset-4">
                Start one
              </Link>
            </p>
          )}
        </SeaSection>
      </div>
    </SeaPage>
  );
}
