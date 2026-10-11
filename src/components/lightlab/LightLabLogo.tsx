import { lightlab } from "@config/lightlab";
import { cn } from "@/lib/cn";

/** The LightLab wordmark: white lettering in dark mode, black in light mode. */
export function LightLabLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={lightlab.logoDarkSrc} alt={lightlab.name} className="h-full w-auto light:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={lightlab.logoSrc} alt={lightlab.name} className="hidden h-full w-auto light:block" />
    </span>
  );
}
