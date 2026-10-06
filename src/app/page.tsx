import Image from "next/image";
import Link from "next/link";
import { gallery } from "@config/gallery";
import { pickup } from "@config/pickup";
import { legal, uploads } from "@config/site";
import { HeroDrop } from "@/components/home/HeroDrop";
import { HowItWorks } from "@/components/home/HowItWorks";
import { MaterialSwatches } from "@/components/home/MaterialSwatches";
import { PriceSlider } from "@/components/home/PriceSlider";
import { Reveal } from "@/components/home/Reveal";
import { SailStartButton } from "@/components/home/SailStartButton";
import { CircleMark } from "@/components/layout/CircleMark";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { MAX_GIFT_CARDS } from "@/lib/codes/apply";
import { getEffectiveConfig } from "@/lib/config/effective";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic"; // shows live rates from admin settings

const steps = [
  { title: "Upload", body: `Drag in one or more .stl files, up to ${uploads.maxFileMb} MB each. Each file is checked for holes and unit mistakes.` },
  { title: "Size", body: "Scale the model in the 3D preview and pick PLA, PETG or PLA-CF and a colour. The price updates as you change things." },
  { title: "Pay", body: "Pay by card, Apple Pay or Google Pay through Square, and choose a pickup time. The order is only placed once the payment goes through." },
  { title: "Pick up", body: "You get an email when your print is ready. The pickup address comes with your receipt." },
];

const faqs = [
  {
    q: "What files can I upload?",
    a: `STL files only (binary or ASCII), up to ${uploads.maxFileMb} MB each and ${uploads.maxFilesPerOrder} files per order. If your model is in another format, export it as STL from your modelling program first.`,
  },
  {
    q: "My model showed up tiny. Why?",
    a: "It was probably modelled in inches. Press “Modelled in inches?” in the size panel and it will be multiplied by 25.4.",
  },
  {
    q: "How is the print time worked out?",
    a: "It's an estimate based on how much filament the part needs, the quality setting and the printer. The real time can be different. You pay the price shown at checkout either way.",
  },
  {
    q: "Where do I pick up my order?",
    a: "The pickup address is shown after you pay and is in your confirmation email. There is no shipping.",
  },
  {
    q: "Which printers do you use?",
    a: "A Bambu Lab A1 Mini for smaller parts and an Elegoo Centauri Carbon for bigger parts and anything in PLA-CF. Each part is sent to the right printer automatically.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, for a full refund, as long as printing hasn't started. After that the order can't be cancelled.",
    link: { href: "/terms", label: "Terms & Conditions" },
  },
  {
    q: "Will you print anything?",
    a: "Only files you have the right to use. No weapons or weapon parts, and nothing illegal. Orders like that are refunded and cancelled.",
    link: { href: "/terms", label: "Terms & Conditions" },
  },
];

export default async function Home() {
  const cfg = await getEffectiveConfig();
  const p = cfg.pricing;

  return (
    <>
      <HeroDrop config={cfg}>
        <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
          Upload an STL.
          <br />
          Get a price.
          <br />
          <span className="text-accent-text">Pick up your print.</span>
        </h1>
        <div className="mt-12 flex flex-wrap gap-4">
          <SailStartButton>Start an order</SailStartButton>
          <ButtonLink href="/library" size="lg" variant="secondary">
            Find a model
          </ButtonLink>
        </div>
      </HeroDrop>

      <PickupStrip />

      {gallery.length > 0 ? (
        <section id="gallery" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
          <Reveal>
            <SectionLabel>Past prints</SectionLabel>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">What we&apos;ve printed</h2>
          </Reveal>
          <ul className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {gallery.map((g, i) => (
              <Reveal as="li" key={g.src} delay={Math.min(i, 6) * 0.05}>
                <figure className="group overflow-hidden rounded-2xl border border-line bg-surface transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow)]">
                  <div className="relative aspect-square overflow-hidden bg-surface-strong">
                    <Image src={g.src} alt={g.alt} fill sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  </div>
                  <figcaption className="p-3">
                    <p className="font-medium leading-tight">{g.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {g.material} · {g.colour}
                    </p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </ul>
        </section>
      ) : null}

      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
        <Reveal>
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">From file to finished part</h2>
        </Reveal>
        <HowItWorks steps={steps} />
      </section>

      <section id="pricing" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
        <Reveal>
          <SectionLabel>Pricing</SectionLabel>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">See what bigger costs</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted">Drag the slider. The price comes from the same pricing as checkout, using today&apos;s rates.</p>
        </Reveal>
        <Reveal delay={0.05} className="mt-12">
          <PriceSlider config={cfg} />
        </Reveal>
        <Reveal delay={0.1}>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <Rate label="Order fee, once per order" value={money(p.baseFeeCents)} />
            <Rate label="Filament" value={`${p.pricePerGramCents}¢ per gram`} />
            <Rate label="Machine time" value={`${money(p.pricePerHourCents)} per hour`} />
            <Rate label="Per printed piece" value={money(p.markupPerPieceCents)} />
            <Rate label="Minimum order" value={money(p.minimumOrderCents)} />
          </dl>
          <p className="mt-4 text-xs text-faint">Some specialty spools, like PLA Wood, cost a little more per gram. All prices in CAD.</p>
        </Reveal>
      </section>

      <section id="materials" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
        <Reveal>
          <SectionLabel>Materials</SectionLabel>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Materials and colours in stock</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted">Tap a colour to see it on a sample print.</p>
        </Reveal>
        <MaterialSwatches materials={cfg.materials} />
      </section>

      <section id="gift-cards" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
        <div className="grid items-center gap-12 rounded-3xl border border-line bg-surface p-8 sm:p-14 md:grid-cols-[1fr_auto]">
          <Reveal>
            <SectionLabel>Gift cards and coupons</SectionLabel>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Have a gift card or coupon?</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-muted">
              Enter the number in the code box at checkout and it comes off your total. Gift cards also need the PIN printed on the card. You can use one coupon and up to{" "}
              {MAX_GIFT_CARDS} gift cards on each order.
            </p>
            <p className="mt-4 max-w-xl leading-relaxed text-muted">
              Want to give one? Email{" "}
              <a href={`mailto:${legal.contactEmail}?subject=Gift%20card`} className="font-medium text-accent-text underline underline-offset-4">
                {legal.contactEmail}
              </a>
              .
            </p>
            <div className="mt-8">
              <ButtonLink href="/gift-cards" size="lg">
                Buy a gift card
              </ButtonLink>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <GiftCardArt />
          </Reveal>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
        <Reveal>
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Questions</h2>
        </Reveal>
        <div className="mt-12 space-y-4">
          {faqs.map((f) => (
            <details key={f.q} className="group glass rounded-2xl px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-line text-accent-text transition-transform duration-300 group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                {f.a}{" "}
                {f.link && (
                  <Link href={f.link.href} className="text-accent-text underline underline-offset-4">
                    {f.link.label}
                  </Link>
                )}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-accent p-10 text-accent-ink sm:flex-row sm:items-center sm:p-14">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Have an STL ready?</h2>
            <p className="mt-2 opacity-80">Upload it and see the price in under a minute.</p>
          </div>
          <ButtonLink href="/order" size="lg" variant="secondary">
            Start an order
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-0.5 font-mono font-medium">{value}</dd>
    </div>
  );
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function clock(h: number) {
  const suffix = h < 12 || h === 24 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

/** Groups days with the same hours: "Monday to Friday, 4 pm to 8 pm". Week starts Monday. */
function pickupHours(hoursByDay: Record<number, [number, number] | null>) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const groups: { days: number[]; hours: [number, number] }[] = [];
  for (const d of order) {
    const h = hoursByDay[d];
    if (!h) continue;
    const last = groups.at(-1);
    const prevDay = last?.days.at(-1);
    const adjacent = prevDay != null && order.indexOf(d) === order.indexOf(prevDay) + 1;
    if (last && adjacent && last.hours[0] === h[0] && last.hours[1] === h[1]) last.days.push(d);
    else groups.push({ days: [d], hours: h });
  }
  return groups.map((g) => {
    const first = DAY_NAMES[g.days[0]];
    const lastDay = DAY_NAMES[g.days.at(-1)!];
    const days = g.days.length === 1 ? first : g.days.length === 2 ? `${first} and ${lastDay}` : `${first} to ${lastDay}`;
    return { days, hours: `${clock(g.hours[0])} to ${clock(g.hours[1])}` };
  });
}

/** Pickup hours and turnaround in one strip. No address here: that's only sent after payment. */
function PickupStrip() {
  const groups = pickupHours(pickup.hours);
  return (
    <section aria-labelledby="pickup-title" className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
      <Reveal>
        <div className="grid gap-8 rounded-3xl border border-line bg-surface p-8 sm:p-12 md:grid-cols-[auto_auto_auto] md:items-center md:justify-between md:gap-16">
          <h2 id="pickup-title" className="font-display text-2xl font-bold">
            Local pickup
          </h2>
          <div>
            <p className="text-sm text-faint">Ready in</p>
            <p className="mt-1 font-display text-xl font-semibold">2 to 5 days</p>
          </div>
          <div>
            <p className="text-sm text-faint">Pickup hours</p>
            <ul className="mt-1 space-y-1 font-medium">
              {groups.map((g) => (
                <li key={g.days} className="md:whitespace-nowrap">
                  {g.days}, {g.hours}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** A gift card in the printed slip's style: the wordmark lettering and the circle mark. */
function GiftCardArt() {
  return (
    <div className="relative mx-auto aspect-[1.586] w-72 -rotate-3 rounded-2xl bg-accent p-5 text-accent-ink shadow-[var(--shadow)] transition-transform duration-200 hover:-translate-y-1 hover:rotate-0 sm:w-80" aria-hidden>
      <CircleMark size={44} className="absolute right-4 top-4 rounded-full ring-2 ring-white/30" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/lettering/coastline-prints.png" alt="" className="h-5 w-auto invert" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/lettering/gift-card.png" alt="" className="mt-3 h-10 w-auto invert" />
      <p className="absolute bottom-5 left-5 font-mono text-sm tracking-widest opacity-80">•••• •••• •••• 2026</p>
    </div>
  );
}
