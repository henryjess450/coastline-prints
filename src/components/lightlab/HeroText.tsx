import { lightlab } from "@config/lightlab";
import { ButtonLink } from "@/components/ui/Button";
import { LightLabLogo } from "./LightLabLogo";
import { PartnerBadge } from "./PartnerBadge";

/** The left side of the LightLab hero: logo, welcome, intro, partner line, button. */
export function LightLabHeroText() {
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
      </div>
    </div>
  );
}
