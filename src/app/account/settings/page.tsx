import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/account/AccountSettings";
import { currentCustomer } from "@/lib/account/auth";
import { profileFor } from "@/lib/account/profile";
import { THEME_COOKIE } from "@/lib/theme";

export const metadata: Metadata = { title: "Account settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const customer = await currentCustomer();
  if (!customer) redirect("/account");
  const profile = await profileFor(customer);
  const current = (await cookies()).get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <Link href="/account" className="group inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <span className="transition-transform group-hover:-translate-x-1" aria-hidden>
          ←
        </span>
        Back to your account
      </Link>
      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">Settings</h1>
      <p className="mt-3 text-muted">Your details fill in checkout for you, so ordering takes a few taps.</p>
      <div className="mt-8">
        <AccountSettings profile={profile} current={current} />
      </div>
    </div>
  );
}
