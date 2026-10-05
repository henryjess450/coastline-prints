import Link from "next/link";
import { uploads } from "@config/site";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionLabel } from "@/components/ui/Card";
import { getEffectiveConfig } from "@/lib/config/effective";
import { hours, money } from "@/lib/format";
import { quoteOrder } from "@/lib/pricing/quote";

export const dynamic = "force-dynamic"; // shows live rates from admin settings

const steps = [
  { title: "Upload", body: `Drag in one or more .stl files, up to ${uploads.maxFileMb} MB each. Each file is checked for holes and unit mistakes.` },
  { title: "Size and colour", body: "Scale the model, pick PLA, PETG or PLA-CF and a colour. The price updates as you change things." },
  { title: "Pay", body: "Pay by card, Apple Pay or Google Pay through Square. The order is only placed once the payment goes through." },
  { title: "Pick up", body: "You get an email when your print is ready. It includes the pickup address." },
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

  // A worked example from the real pricing engine: a 20 mm calibration cube.
  const cube = { size: { x: 20, y: 20, z: 20 }, volumeMm3: 8000, surfaceAreaMm2: 2400, material: "PLA" as const, colorId: cfg.materials[0].colors.find((c) => c.available && c.pricePerGramCents == null)?.id ?? "", quality: "standard", infill: "standard" };
  const one = quoteOrder([{ ...cube, quantity: 1 }], cfg);
  const ten = quoteOrder([{ ...cube, quantity: 10 }], cfg);
  const oneItem = one.items[0];

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
              Upload an STL.
              <br />
              Get a price.
              <br />
              <span className="text-accent-text">Pick up your print.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              PLA, PETG and carbon-fibre PLA, printed on a Bambu Lab A1 Mini or an Elegoo Centauri Carbon. You see the exact price before you pay.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <ButtonLink href="/order" size="lg">
                Start an order
              </ButtonLink>
              <ButtonLink href="/library" size="lg" variant="secondary">
                Find a model
              </ButtonLink>
            </div>
          </div>

          <HeroBlocks />
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <SectionLabel>How it works</SectionLabel>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">From file to finished part</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full p-6">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent font-display text-lg font-bold text-accent-ink">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <SectionLabel>Pricing</SectionLabel>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">How your price is worked out</h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card className="p-6">
            <dl className="divide-y divide-line text-sm">
              <PriceRow label="Order fee (once per order)" value={money(p.baseFeeCents)} />
              <PriceRow label="Filament" value={`${p.pricePerGramCents}¢ per gram`} />
              <PriceRow label="Machine time" value={`${money(p.pricePerHourCents)} per hour`} />
              <PriceRow label="Per printed piece" value={money(p.markupPerPieceCents)} />
              <PriceRow label="Minimum order" value={money(p.minimumOrderCents)} />
            </dl>
            <p className="mt-4 text-xs text-faint">Some specialty spools, like PLA Wood, cost a little more per gram. All prices in CAD.</p>
          </Card>
          <Card className="p-6">
            <h3 className="font-semibold">Example: a 20 mm cube in PLA</h3>
            <p className="mt-1 text-sm text-muted">Standard quality, standard infill.</p>
            {oneItem?.ok && (
              <dl className="mt-4 space-y-1 text-sm">
                <PriceRow label={`Filament (${oneItem.gramsEach.toFixed(1)} g)`} value={money(oneItem.filamentCents)} />
                <PriceRow label={`Machine time (${hours(oneItem.hoursTotal)})`} value={money(oneItem.machineCents)} />
                <PriceRow label="Per-piece fee" value={money(oneItem.markupCents)} />
                <PriceRow label="Order fee" value={money(one.baseFeeCents)} />
                {one.minimumAdjCents > 0 && <PriceRow label="Minimum order top-up" value={money(one.minimumAdjCents)} />}
                <div className="flex justify-between border-t-2 border-line-strong pt-2 font-semibold">
                  <span>1 cube</span>
                  <span className="font-mono">{money(one.totalCents)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>10 cubes in one order</span>
                  <span className="font-mono">{money(ten.totalCents)}</span>
                </div>
              </dl>
            )}
          </Card>
        </div>
      </section>

      <section id="materials" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <SectionLabel>Materials</SectionLabel>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Materials and colours in stock</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {cfg.materials.map((m) => {
            const colors = m.colors.filter((c) => c.available);
            return (
              <Card key={m.id} className="p-6">
                <h3 className="font-display text-xl font-bold">{m.name}</h3>
                <p className="mt-1 text-sm text-muted">{m.description}</p>
                <ul className="mt-4 space-y-1.5 text-sm" aria-label={`${m.name} colours`}>
                  {colors.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span className="h-4 w-4 shrink-0 rounded-full border border-line-strong" style={{ background: c.hex }} />
                      {c.name}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="printers" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <SectionLabel>Printers</SectionLabel>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Each part goes to the right printer</h2>
        <p className="mt-2 max-w-2xl text-muted">
          Small parts print on the A1 Mini. Bigger parts, and anything in PLA-CF, print on the Centauri Carbon. A {cfg.safetyMarginMm} mm margin is kept free on every side.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {cfg.printers.map((pr) => (
            <Card key={pr.id} className="p-6">
              <h3 className="font-display text-xl font-bold">{pr.name}</h3>
              <p className="mt-1 font-mono text-sm text-muted">
                {pr.buildVolume.x} × {pr.buildVolume.y} × {pr.buildVolume.z} mm bed · max part {pr.buildVolume.x - cfg.safetyMarginMm} mm
              </p>
              <p className="mt-3 text-sm text-muted">Prints: {pr.materials.join(", ")}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6">
        <SectionLabel>FAQ</SectionLabel>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Questions</h2>
        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group glass rounded-xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-line text-accent-text transition-transform duration-300 group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted">
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
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-accent p-8 text-accent-ink sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Have an STL ready?</h2>
            <p className="mt-1 opacity-80">Upload it and see the price in under a minute.</p>
          </div>
          <ButtonLink href="/order" size="lg" variant="secondary">
            Start an order
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono font-medium">{value}</dd>
    </div>
  );
}

/** Solid-colour stacked "print" made of blocks, with a few toy shapes. */
function HeroBlocks() {
  const layers = [
    { w: "86%", c: "#0e4471" },
    { w: "74%", c: "#185a92" },
    { w: "62%", c: "#2f74b3" },
    { w: "50%", c: "#4f91cc" },
    { w: "38%", c: "#7bb0e0" },
    { w: "26%", c: "#a9cdef" },
  ];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md" aria-hidden>
      <div className="absolute inset-x-0 bottom-6 mx-auto h-4 w-[92%] rounded-sm bg-line-strong" />
      <div className="absolute inset-x-0 bottom-10 flex flex-col-reverse items-center gap-1.5">
        {layers.map((l, i) => (
          <div
            key={i}
            className="h-10 rounded-full  motion-safe:animate-[layer-in_0.6s_cubic-bezier(0.34,1.56,0.64,1)_both]"
            style={{ width: l.w, background: l.c, animationDelay: `${0.15 + i * 0.12}s` }}
          />
        ))}
      </div>
      <div className="absolute left-2 top-6 h-14 w-14 rotate-12 rounded-2xl  bg-seafoam motion-safe:animate-[bob_4s_ease-in-out_infinite]" />
      <div className="absolute right-4 top-16 h-10 w-10 -rotate-12 rounded-full  bg-sand motion-safe:animate-[bob_5s_ease-in-out_0.6s_infinite]" />
    </div>
  );
}
