import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribeTokenOk } from "@/lib/broadcast";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The link in news and promotion emails: one tap and they're off the list. Order emails still come. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ c?: string; t?: string }> }) {
  const { c = "", t = "" } = await searchParams;
  const ok = !!c && !!t && unsubscribeTokenOk(c, t) && (await db.customer.updateMany({ where: { id: c }, data: { emailOptOut: true } })).count === 1;
  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-20 text-center sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight">{ok ? "You're unsubscribed" : "That link didn't work"}</h1>
      <p className="mt-4 text-muted">
        {ok
          ? "No more news or offers from us. You'll still get emails about your own orders. Changed your mind? Turn them back on in your account."
          : "It may have been copied only partly. You can turn news and offers off in your account instead."}
      </p>
      <Link href="/account#details" className="mt-8 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-ink">
        Go to your account
      </Link>
    </div>
  );
}
