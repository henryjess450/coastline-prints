import { site } from "@config/site";
import { CircleMark } from "./CircleMark";

/**
 * Circle wave mark + the hand-drawn wordmark. The white wordmark shows in
 * dark mode and the black one in light mode.
 */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const mark = size === "lg" ? 52 : 36;
  const wordH = size === "lg" ? "h-14" : "h-10";
  return (
    <span className="inline-flex items-center gap-2.5">
      <CircleMark size={mark} label={site.name} className="shrink-0" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/wordmark-white.png" alt="" aria-hidden className={`${wordH} w-auto light:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/wordmark-black.png" alt="" aria-hidden className={`${wordH} hidden w-auto light:block`} />
    </span>
  );
}
