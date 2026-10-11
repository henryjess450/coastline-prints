import { lightlab } from "@config/lightlab";
import { ButtonLink } from "@/components/ui/Button";
import { dayParts, type MarketDto } from "@/lib/shop/markets";
import { LightLabLogo } from "./LightLabLogo";
import { PartnerBadge } from "./PartnerBadge";

/** The left side of the LightLab hero: logo, welcome, intro, partner line, button, and the next market. */
export function LightLabHeroText({ nextMarket, today }: { nextMarket?: MarketDto | null; today?: string }) {
  return (
    <div>
      <h1 className="sr-only">{lightlab.name}</h1>
      <LightLabLogo className="h-24 sm:h-32 lg:h-40" />
      <p className="ll-accent mt-10 text-5xl sm:text-6xl">Welcome to LightLab!</p>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted">
        LightLab is a novelty lamp shop in Victoria, BC. We sell at local markets, and here in our online storefront for orders from people like you. Pick up for free, or have it shipped anywhere in Canada.
      </p>
      <PartnerBadge className="mt-8" />
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/lightlab#shop" size="lg">
          Shop the collection
        </ButtonLink>
        {nextMarket && <NextMarket m={nextMarket} today={nextMarket.date === today} />}
      </div>
    </div>
  );
}

/** Shaped like the button beside it (same height), but just information: when and where the next market is. Sized to show the whole name. */
function NextMarket({ m, today }: { m: MarketDto; today: boolean }) {
  const d = dayParts(m.date);
  return (
    <p className="inline-flex min-h-14 max-w-full items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-2 pr-6">
      <span className="flex h-10 shrink-0 flex-col items-center justify-center rounded-full bg-accent px-3 text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-accent-ink" aria-hidden>
        <span>{today ? "Today" : d.weekday}</span>
        <span>
          {d.month} {d.day}
        </span>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="ll-accent block text-lg/tight">next market</span>
        <span className="block text-base/tight font-semibold">
          <span className="sr-only">{d.long}, </span>
          {m.name}
        </span>
      </span>
    </p>
  );
}
