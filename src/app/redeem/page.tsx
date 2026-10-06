import type { Metadata } from "next";
import { RedeemForm } from "@/components/account/RedeemForm";
import { SignIn } from "@/components/account/SignIn";
import { Wallet } from "@/components/account/Wallet";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { currentCustomer } from "@/lib/account/auth";
import { walletFor } from "@/lib/account/wallet";

export const metadata: Metadata = {
  title: "Save a gift card or coupon",
  description: "Save your Coastline Prints gift card or coupon to your account so it's ready to tap at checkout, and only you can use it.",
};
export const dynamic = "force-dynamic";

export default async function RedeemPage() {
  const customer = await currentCustomer();
  const items = customer ? await walletFor(customer.id) : [];
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
      <div className="mb-6 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Save your gift card or coupon</h1>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted">Save it to your account and it&apos;s ready to tap at checkout. It&apos;s also locked to you, so if the card or email gets lost, nobody else can use it.</p>
      </div>

      {customer ? (
        <>
          <Card flat className="p-6 sm:p-8">
            <p className="mb-5 text-sm text-muted">Signed in as {customer.email}</p>
            <RedeemForm />
          </Card>
          {items.length > 0 && (
            <Card flat className="p-6 sm:p-8">
              <h2 className="mb-5 font-display text-xl font-bold">Saved to your account</h2>
              <Wallet items={items} />
              <div className="mt-6">
                <ButtonLink href="/order">Start an order</ButtonLink>
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card flat className="p-6 sm:p-10">
          <SignIn intro="First, sign in with your email. We'll send you a 6-digit code. No password needed, and new accounts are made automatically." />
        </Card>
      )}
    </div>
  );
}
