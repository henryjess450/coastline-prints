import type { Metadata } from "next";
import { POINTS_PER_DOLLAR, prizes } from "@config/rewards";
import { SignIn } from "@/components/account/SignIn";
import { RewardsBoard } from "@/components/rewards/RewardsBoard";
import { Card } from "@/components/ui/Card";
import { currentCustomer } from "@/lib/account/auth";
import { getEffectiveConfig } from "@/lib/config/effective";
import { money } from "@/lib/format";
import { rewardsSummary } from "@/lib/rewards/server";

export const metadata: Metadata = {
  title: "Rewards",
  description: `Earn ${POINTS_PER_DOLLAR} points for every $1 you spend on 3D prints, and trade them for money off and gift cards.`,
};
export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const [customer, cfg] = await Promise.all([currentCustomer(), getEffectiveConfig()]);
  const summary = customer ? await rewardsSummary(customer.email) : null;
  // The order-fee prize shows the current fee.
  const list = prizes.map((p) => ({ ...p, value: p.kind === "order-fee" ? `${money(cfg.pricing.baseFeeCents)} off` : p.kind === "gift-card" ? `${money(p.valueCents ?? 0)} gift card` : `${money(p.valueCents ?? 0)} off` }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
      <div className="mb-6 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Coastline Rewards</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted">
          Earn {POINTS_PER_DOLLAR} points for every $1 you spend on prints. Trade them for money off and gift cards.
        </p>
      </div>
      <RewardsBoard prizes={list} summary={summary} signedIn={!!customer} />
      {!customer && (
        <Card flat className="p-6 sm:p-10">
          <SignIn intro="Sign in with the email you order with to see your points. They're already counting, even if you haven't made an account yet." />
        </Card>
      )}
    </div>
  );
}
