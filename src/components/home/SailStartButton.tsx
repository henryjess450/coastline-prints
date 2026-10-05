"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClass, squash } from "@/components/ui/Button";
import { SAIL_EVENT } from "./HeroWater";

/** How long the Benchy sails off before the order page opens. */
const SAIL_MS = 950;

/**
 * "Start an order" in the hero. The Benchy speeds off to the right and the
 * hero fades, then the order page opens. Ctrl/Cmd-click and reduced motion
 * skip the animation and go straight there.
 */
export function SailStartButton({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href="/order"
      className={buttonClass("primary", "lg")}
      onMouseEnter={() => router.prefetch("/order")}
      onClick={(e) => {
        squash(e.currentTarget);
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        e.preventDefault();
        router.prefetch("/order");
        window.dispatchEvent(new Event(SAIL_EVENT));
        window.setTimeout(() => router.push("/order"), SAIL_MS);
      }}
    >
      {children}
    </Link>
  );
}
