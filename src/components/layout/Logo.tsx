import { useId } from "react";
import { site } from "@config/site";

/**
 * Site logo. Uses the image at `site.logoSrc` once it's set; until then it
 * draws a placeholder wave mark next to the wordmark.
 */
export function Logo() {
  const title = `logo${useId().replace(/[^\w-]/g, "")}`;
  if (site.logoSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={site.logoSrc} alt={site.name} className="h-8 w-auto" />;
  }
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" role="img" aria-labelledby={title}>
        <title id={title}>{site.name}</title>
        <circle cx="16" cy="16" r="15" fill="#0e4471" />
        <path d="M5 17c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0 2.2 2 2.2 2" stroke="#ffffff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M7 22.5c1.8-1.5 3.6-1.5 5.4 0s3.6 1.5 5.4 0 3.6-1.5 5.4 0" stroke="#86bbea" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="21.5" cy="10" r="3" fill="#e9c46a" />
      </svg>
      <span className="font-display text-lg font-bold leading-none tracking-tight text-fg">
        Coastline <span className="text-accent-text">Prints</span>
      </span>
    </span>
  );
}
