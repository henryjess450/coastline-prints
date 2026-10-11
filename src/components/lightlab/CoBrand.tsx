import Link from "next/link";
import { site } from "@config/site";
import { lightlab } from "@config/lightlab";
import { CircleMark } from "@/components/layout/CircleMark";
import { LightLabLogo } from "./LightLabLogo";

/** Header logo on the LightLab pages: Coastline Prints × LightLab | Victoria. */
export function CoBrand() {
  return (
    <span className="inline-flex items-center gap-2 sm:gap-3">
      <Link href="/" aria-label={`${site.name} home`} className="inline-flex shrink-0 items-center gap-2.5">
        <CircleMark size={36} label={site.name} className="shrink-0" />
        {/* The wordmark only fits beside both logos on wider screens. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/wordmark-white.png" alt="" aria-hidden className="hidden h-10 w-auto light:hidden md:block" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/wordmark-black.png" alt="" aria-hidden className="hidden h-10 w-auto md:light:block" />
      </Link>
      <span aria-hidden className="text-lg font-light text-faint sm:text-xl">
        ×
      </span>
      <Link href="/lightlab" aria-label={`${lightlab.name} shop`} className="inline-flex">
        <LightLabLogo className="h-9 sm:h-10" />
      </Link>
    </span>
  );
}
