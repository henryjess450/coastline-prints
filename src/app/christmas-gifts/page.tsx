import type { Metadata } from "next";
import Link from "next/link";
import { pickup } from "@config/pickup";
import { holiday } from "@config/promotions";
import { seo } from "@config/site";
import { GiftCardFace, Holly } from "@/components/gifts/GiftCardFace";
import { LightString, LivingRoomPicture, SnowOverlay } from "@/components/holiday/HolidayScenes";
import { ButtonLink } from "@/components/ui/Button";
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
    <div>
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Christmas gifts", path: "/christmas-gifts" }])} />
      {/* Snowy night hero with a string of lights and the living room */}
      <section className="relative overflow-hidden" style={{ background: "#10233a" }}>
        <LightString className="relative z-10 h-12 w-full sm:h-14" />
        <SnowOverlay className="pointer-events-none absolute inset-0 h-full w-full" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-6 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pb-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "#e9c46a" }}>
              Christmas {holiday.year} · {place}
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">3D printed Christmas gifts, made in {seo.city}</h1>
            <p className="mt-5 text-lg leading-relaxed text-white/80">
              Find a model, pick a colour, and pick it up in downtown {seo.city} in time for Christmas. Or send a holiday gift card: it arrives wrapped as a present they open on their screen.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/gift-cards?design=holiday" size="lg" className="!bg-[#c8322b] !text-white">
                Send a holiday gift card
              </ButtonLink>
              <ButtonLink href="/order" size="lg" variant="secondary">
                Start an order
              </ButtonLink>
            </div>
          </div>
          <LivingRoomPicture className="aspect-[16/9] w-full overflow-hidden rounded-3xl border-4 border-[#e9c46a]/70" />
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        {(live || upcoming) && (
          <div className="relative mt-12 overflow-hidden rounded-3xl p-6 text-white sm:p-8" style={{ background: "#a51d1d" }}>
            <Holly className="absolute right-5 top-4 w-16 sm:w-20" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">{live ? b.name : `${b.name} starts ${longDay(b.startsOn)}`}</p>
            <p className="mt-2 max-w-md font-display text-2xl font-bold">{bonusLine(b).replace(/^./, (c) => c.toUpperCase())}.</p>
            <div className="mt-5">
              <ButtonLink href="/gift-cards?design=holiday" size="lg" variant="secondary">
                Send a gift card
              </ButtonLink>
            </div>
          </div>
        )}

        <section className="mt-14 grid items-center gap-8 sm:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="font-display text-2xl font-bold">A gift card they unwrap</h2>
            <p className="mt-3 leading-relaxed text-muted">
              Holiday gift cards arrive by email as a present. They tap the button, watch it land under the tree, and it opens to show them their card. Schedule it for 9 am on Christmas morning if you like.
            </p>
            <Link href="/gift-cards?design=holiday" className="mt-4 inline-block font-medium text-accent-text underline underline-offset-4">
              Choose an amount
            </Link>
          </div>
          <GiftCardFace design="holiday" amount="$50" to="someone special" className="-rotate-2 text-[13px]" />
        </section>

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
                <Link href={`/library?q=${encodeURIComponent(i.search)}`} className="block h-full rounded-2xl border border-line border-t-4 bg-surface p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow)]" style={{ borderTopColor: ideas.indexOf(i) % 2 ? "#1d6b3c" : "#c8322b" }}>
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
          <ButtonLink href="/gift-cards?design=holiday" size="lg" variant="secondary">
            Gift cards
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
