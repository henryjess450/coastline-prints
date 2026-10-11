import type { Metadata } from "next";
import Link from "next/link";
import { pickup } from "@config/pickup";
import { holiday } from "@config/promotions";
import { seo } from "@config/site";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { bonusLine, bonusLive } from "@/lib/giftcards/bonus";
import { getGiftBonus } from "@/lib/giftcards/bonus.server";
import { todayIn } from "@/lib/pickup";
import { breadcrumbs, JsonLd, place } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: `3D Printed Christmas Gifts in ${place} · Coastline Prints` },
  description: `3D printed Christmas gifts, ornaments and stocking stuffers, made in downtown ${seo.city}. Order by December ${Number(holiday.orderForPickupBy.slice(8))} for pickup, or send a gift card by email.`,
  alternates: { canonical: "/christmas-gifts" },
};
export const dynamic = "force-dynamic"; // the bonus and dates depend on today

const ideas: { name: string; search: string; note: string }[] = [
  { name: "Ornaments", search: "christmas ornament", note: "Snowflakes, stars and baubles. Silk PLA catches the tree lights." },
  { name: "Name tags and keychains", search: "name keychain", note: "Personalised on MakerWorld or Printables, then printed here." },
  { name: "Stocking stuffers", search: "fidget", note: "Fidget toys, articulated dragons, tiny figures." },
  { name: "Village and nativity pieces", search: "christmas village", note: "Houses, trees and figures for a mantel scene." },
  { name: "Planters and vases", search: "planter", note: "For the plant lover. Rainbow and silk spools look great here." },
  { name: "Desk and gaming gifts", search: "headphone stand", note: "Headphone and controller stands, dice towers, cable tidies." },
];

const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });

export default async function ChristmasPage() {
  const b = await getGiftBonus();
  const today = todayIn(pickup.timeZone);
  const live: boolean = bonusLive(b, today);
  const upcoming = b.on && today < b.startsOn;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Christmas gifts", path: "/christmas-gifts" }])} />
      <SectionLabel>Christmas {holiday.year}</SectionLabel>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">3D printed Christmas gifts, made in {seo.city}</h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">
        Find a model, pick a colour, and pick it up in downtown {seo.city} in time for Christmas. Or skip the guessing and email a gift card. They work on any print and never expire.
      </p>

      {(live || upcoming) && (
        <div className="mt-8 rounded-3xl bg-accent p-6 text-accent-ink sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{live ? b.name : `${b.name} starts ${longDay(b.startsOn)}`}</p>
          <p className="mt-2 font-display text-2xl font-bold">{bonusLine(b).replace(/^./, (c) => c.toUpperCase())}.</p>
          <div className="mt-5">
            <ButtonLink href="/gift-cards" size="lg" variant="secondary">
              Send a gift card
            </ButtonLink>
          </div>
        </div>
      )}

      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold">Order by</h2>
        <dl className="mt-5 divide-y divide-line border-y border-line">
          <div className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
            <dt className="font-medium">Pickup in {seo.city}</dt>
            <dd className="text-muted">{longDay(holiday.orderForPickupBy)}. Prints take 2 to 5 days, and you book your pickup time at checkout.</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
            <dt className="font-medium">Shipping in Canada</dt>
            <dd className="text-muted">Aim for {longDay(holiday.orderForShippingBy)}. Canada Post gets busy in December, so earlier is safer.</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
            <dt className="font-medium">Gift cards</dt>
            <dd className="text-muted">Any time, even Christmas morning. Schedule one to arrive at 9 am on the day you choose.</dd>
          </div>
        </dl>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold">Gift ideas</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {ideas.map((i) => (
            <li key={i.name}>
              <Link href={`/library?q=${encodeURIComponent(i.search)}`} className="block h-full rounded-2xl border border-line bg-surface p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow)]">
                <h3 className="font-display text-lg font-bold">{i.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{i.note}</p>
                <p className="mt-3 text-sm font-medium text-accent-text">Find models →</p>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">
          Found one? Download the file and <Link href="/order" className="font-medium text-accent-text underline underline-offset-4">upload it here</Link> to see the price. More ideas on the{" "}
          <Link href="/3d-printing/gifts" className="font-medium text-accent-text underline underline-offset-4">gifts page</Link>.
        </p>
      </section>

      <div className="mt-14 flex flex-wrap gap-4">
        <ButtonLink href="/order" size="lg">
          Start an order
        </ButtonLink>
        <ButtonLink href="/gift-cards" size="lg" variant="secondary">
          Gift cards
        </ButtonLink>
      </div>
    </div>
  );
}
