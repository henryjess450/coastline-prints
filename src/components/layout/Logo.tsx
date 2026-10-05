import { useId } from "react";
import { site } from "@config/site";

/**
 * Circle wave mark + the hand-drawn wordmark. The white wordmark shows in
 * dark mode and the black one in light mode.
 */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const title = `logo${useId().replace(/[^\w-]/g, "")}`;
  const mark = size === "lg" ? 52 : 36;
  const wordH = size === "lg" ? "h-14" : "h-10";
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={mark} height={mark} viewBox="0 0 32 32" role="img" aria-labelledby={title} className="shrink-0">
        <title id={title}>{site.name}</title>
        <circle cx="16" cy="16" r="15" fill="#0e4471" />
        <path d="M5 17c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0 2.2 2 2.2 2" stroke="#ffffff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M7 22.5c1.8-1.5 3.6-1.5 5.4 0s3.6 1.5 5.4 0 3.6-1.5 5.4 0" stroke="#86bbea" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="21.5" cy="10" r="3" fill="#e9c46a" />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/wordmark-white.png" alt="" aria-hidden className={`${wordH} w-auto light:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/wordmark-black.png" alt="" aria-hidden className={`${wordH} hidden w-auto light:block`} />
    </span>
  );
}
