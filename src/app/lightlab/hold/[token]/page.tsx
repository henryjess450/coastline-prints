import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LetItGo } from "@/components/lightlab/LetItGo";
import { db } from "@/lib/db";
import { clock, dayParts, mapsUrl } from "@/lib/shop/markets";
import { holdIsLive } from "@/lib/shop/stand.server";

export const metadata: Metadata = { title: "Your hold", robots: { index: false } };
export const dynamic = "force-dynamic";

/** A customer's stand hold: when and where to come, or let it go. */
export default async function HoldPage({ params }: { params: Promise<{ token: string }> }) {
  const h = await db.standHold.findUnique({ where: { token: (await params).token } });
  if (!h) notFound();
  const m = await db.market.findUnique({ where: { id: h.marketId } });
  if (!m) notFound();
  const live = await holdIsLive(h);
  const where = [m.place, m.address].filter(Boolean).join(", ");
  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <Link href="/lightlab" className="ll-link text-sm text-muted hover:text-fg">
        ← LightLab
      </Link>
      <p className="ll-accent mt-8 text-3xl">{live ? "see you soon" : "this hold is over"}</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {h.quantity > 1 ? `${h.quantity} × ` : ""}
        {h.label}
      </h1>
      <dl className="mt-8 space-y-4 rounded-3xl border border-line bg-surface p-6">
        <div>
          <dt className="text-sm text-muted">Where</dt>
          <dd className="font-medium">
            LightLab stand at {m.name}
            {where && (
              <>
                {" · "}
                <a href={mapsUrl(where)} target="_blank" rel="noopener noreferrer" className="text-accent-text underline underline-offset-4">
                  {where}
                </a>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">When</dt>
          <dd className="font-medium">
            {dayParts(m.date).long}, {clock(h.slotStart)} to {clock(h.slotEnd)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Pay</dt>
          <dd className="font-medium">At the stand: card, cash or e-Transfer</dd>
        </div>
      </dl>
      {live ? (
        <>
          <p className="mt-6 text-muted">We&apos;ll hold it until {clock(h.slotEnd)}. After that it goes back up for grabs.</p>
          <LetItGo token={h.token} />
        </>
      ) : (
        <p className="mt-6 text-muted">{h.status === "COLLECTED" ? "Picked up. Enjoy your lamp!" : h.status === "CANCELLED" ? "You let this one go. Thanks for the heads-up!" : "The time has passed, so it's back up for grabs. Still want it? Come by the stand and see if it's there."}</p>
      )}
    </div>
  );
}
