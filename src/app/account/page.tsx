import type { Metadata } from "next";
import Link from "next/link";
import { prizes } from "@config/rewards";
import { AccountHero } from "@/components/account/fun/AccountHero";
import { OrdersList } from "@/components/account/fun/OrdersList";
import { PointsCard } from "@/components/account/fun/PointsCard";
import { SignInScreen } from "@/components/account/fun/SignInScreen";
import { WelcomeBurst } from "@/components/account/fun/WelcomeBurst";
import { RedeemForm } from "@/components/account/RedeemForm";
import { SignOutButton } from "@/components/account/SignOutButton";
import { Wallet } from "@/components/account/Wallet";
import { Reveal } from "@/components/home/Reveal";
import { Card } from "@/components/ui/Card";
import { currentCustomer } from "@/lib/account/auth";
import { firstName, profileFor } from "@/lib/account/profile";
import { walletFor } from "@/lib/account/wallet";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { rewardsSummary } from "@/lib/rewards/server";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const customer = await currentCustomer();
  if (!customer)
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
        <SignInScreen intro="Sign in to see your gift cards, coupons, reward points and orders. Saved cards are ready to tap at checkout." />
      </div>
    );

  const [items, points, orders, profile] = await Promise.all([
    walletFor(customer.id),
    rewardsSummary(customer.email),
    db.order.findMany({ where: { customerEmail: customer.email }, orderBy: { createdAt: "desc" }, take: 20, select: { orderNumber: true, viewToken: true, status: true, totalCents: true, createdAt: true } }),
    profileFor(customer),
  ]);
  // Greet them by their saved (or latest order's) first name, or the start of their email.
  const name = firstName(profile);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <WelcomeBurst />
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

      <Reveal>
        <PointsCard balance={points.balance} pending={points.pending} milestones={prizes.map((p) => ({ points: p.points, title: p.title }))} />
      </Reveal>

      <Reveal>
        <Card flat className="p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Gift cards and coupons</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">Locked to your account, so only you can spend them. Tap a gift card to flip it over.</p>
          <div className="mt-6">
            <Wallet items={items} />
          </div>
        </Card>
      </Reveal>

      <Reveal>
        <Card flat className="p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Add a gift card or coupon</h2>
          <div className="mt-5">
            <RedeemForm />
          </div>
        </Card>
      </Reveal>

      <Reveal>
        <Card flat className="p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Your orders</h2>
          {orders.length ? (
            <div className="mt-5">
              <OrdersList
                orders={orders.map((o) => ({
                  orderNumber: o.orderNumber,
                  viewToken: o.viewToken,
                  status: o.status,
                  total: money(o.totalCents),
                  date: o.createdAt.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Vancouver" }),
                }))}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              No orders with this email yet.{" "}
              <Link href="/order" className="text-accent-text underline underline-offset-4">
                Start one
              </Link>
            </p>
          )}
        </Card>
      </Reveal>
    </div>
  );
}
