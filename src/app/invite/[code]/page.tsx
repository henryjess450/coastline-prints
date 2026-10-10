import type { Metadata } from "next";
import { invite } from "@config/rewards";
import { SaveInvite } from "@/components/account/SaveInvite";
import { ButtonLink } from "@/components/ui/Button";
import { profileFor } from "@/lib/account/profile";
import { normalizeCode } from "@/lib/codes/apply";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

export const metadata: Metadata = {
  title: "You're invited",
  description: "Money off your first 3D print order at Coastline Prints.",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

/**
 * Where an invite link lands. Shows who sent it and what it's worth, and
 * keeps the code in the browser so checkout adds it by itself.
 */
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode(decodeURIComponent((await params).code)).slice(0, 40);
  const row = await db.promoCode.findUnique({ where: { code }, include: { referrer: true } });
  const ok = !!row?.referrer && row.active;
  // Only a saved name, never anything from their email.
  const from = ok ? (await profileFor(row.referrer!)).name.trim().split(/\s+/)[0] || "A friend" : "";
  const off = invite.friendCents % 100 ? money(invite.friendCents) : `$${invite.friendCents / 100}`;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
      {ok ? (
        <>
          <SaveInvite code={code} />
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-text">{from} sent you</p>
          <h1 className="mt-3 font-display text-6xl font-bold tracking-tight sm:text-7xl">{off} off</h1>
          <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted">
            your first 3D print order at Coastline Prints. Upload a model, pick a colour, and the code <span className="whitespace-nowrap font-mono text-fg">{code}</span> is added at checkout for you.
          </p>
          <ButtonLink href="/order" size="lg" className="mt-8">
            Start your order
          </ButtonLink>
        </>
      ) : (
        <>
          <h1 className="font-display text-4xl font-bold tracking-tight">That invite link doesn&apos;t work</h1>
          <p className="mx-auto mt-4 max-w-md text-muted">Check it was copied in full, or ask your friend to send it again.</p>
          <ButtonLink href="/order" variant="secondary" className="mt-8">
            Start an order anyway
          </ButtonLink>
        </>
      )}
    </div>
  );
}
