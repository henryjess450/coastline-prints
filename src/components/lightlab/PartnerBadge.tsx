import Link from "next/link";
import { lightlab } from "@config/lightlab";
import { CircleMark } from "@/components/layout/CircleMark";
import { cn } from "@/lib/cn";

/** "Coastline Prints is the Preferred 3D Printing Partner of LightLab | Victoria" */
export function PartnerBadge({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-5 text-sm transition-colors hover:border-accent-line", className)}>
      <CircleMark size={32} className="shrink-0 transition-transform duration-300 group-hover:rotate-[20deg]" />
      <span className="leading-snug">
        <strong className="font-semibold">Coastline Prints</strong> is the Preferred 3D Printing Partner of <strong className="font-semibold">{lightlab.name}</strong>
      </span>
    </Link>
  );
}
