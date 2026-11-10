import Link from "next/link";
import type { WildPhotoDto } from "@/lib/shop/wild.server";
import { FadeImg } from "./FadeImg";

/**
 * "In the wild": customers' photos of their lamps at home, in a loose
 * staggered wall. Each one credits its Instagram name and links to the lamp.
 */
export function WildWall({ photos, products, title = "In the wild", kicker = "your lamps, your places" }: { photos: WildPhotoDto[]; /** Lamp names and links, for the label under each photo. */ products: Map<string, { name: string; href: string }>; title?: string; kicker?: string }) {
  if (!photos.length) return null;
  return (
    <section aria-labelledby="in-the-wild" className="mx-auto mt-28 max-w-7xl px-4 sm:px-6">
      <p className="ll-accent text-3xl">{kicker}</p>
      <h2 id="in-the-wild" className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <ul className="mt-8 columns-2 gap-4 sm:columns-3 lg:columns-4 [&>li]:mb-4">
        {photos.map((w, i) => {
          const lamp = w.productId ? products.get(w.productId) : null;
          return (
            // A gentle tilt, alternating, like prints pinned to a board. Straightens on hover.
            <li key={w.id} className="break-inside-avoid">
              <figure className={`group overflow-hidden rounded-3xl border border-line bg-surface transition-transform duration-300 ease-out hover:rotate-0 hover:scale-[1.02] ${i % 3 === 0 ? "-rotate-1" : i % 3 === 1 ? "rotate-1" : ""}`}>
                <div className="relative">
                  <FadeImg src={w.url} alt={[w.caption, lamp?.name && `${lamp.name} at a customer's home`].filter(Boolean).join(". ") || "A LightLab lamp at a customer's home"} loading="lazy" className="w-full" />
                </div>
                {(w.handle || lamp || w.caption) && (
                  <figcaption className="space-y-0.5 px-4 py-3 text-sm">
                    {w.caption && <p>{w.caption}</p>}
                    <p className="flex flex-wrap gap-x-2 text-muted">
                      {lamp && (
                        <Link href={lamp.href} className="ll-link text-fg">
                          {lamp.name}
                        </Link>
                      )}
                      {w.handle && (
                        <a href={`https://www.instagram.com/${w.handle}/`} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
                          @{w.handle}
                        </a>
                      )}
                    </p>
                  </figcaption>
                )}
              </figure>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
