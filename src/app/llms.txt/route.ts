import { etransfer } from "@config/payments";
import { legal, seo, site } from "@config/site";
import { getEffectiveConfig } from "@/lib/config/effective";
import { money } from "@/lib/format";
import { guides } from "@/lib/guides";
import { absolute } from "@/lib/seo";
import { uses } from "@/lib/uses";

export const dynamic = "force-dynamic"; // quotes live rates

/**
 * /llms.txt: a plain summary for AI assistants (ChatGPT, Claude, Perplexity...)
 * so they describe the shop correctly and link to the right pages.
 * Format: https://llmstxt.org
 */
export async function GET() {
  const cfg = await getEffectiveConfig();
  const p = cfg.pricing;
  const link = (title: string, path: string, note?: string) => `- [${title}](${absolute(path)})${note ? `: ${note}` : ""}`;

  const body = `# ${site.name}

> Custom 3D printing shop in ${seo.neighbourhood}, ${seo.regionName}, Canada. Customers upload an STL or 3MF file, see an instant price, pay online, and pick up in downtown Victoria or get it shipped anywhere in Canada. Usually ready in 2 to 5 days.

## Key facts

- Location: ${seo.neighbourhood}, ${seo.region}, Canada. Serves ${seo.areaServed.filter((a) => a !== "Canada").join(", ")}; ships Canada-wide by Canada Post.
- Materials: ${cfg.materials.map((m) => m.name).join(", ")}. Multicolour prints up to 4 colours from painted 3MF files.
- Pricing (CAD): ${money(p.baseFeeCents)} order fee, ${p.pricePerGramCents} cents per gram, ${money(p.pricePerHourCents)} per printer hour, ${money(p.markupPerPieceCents)} per piece, ${money(p.minimumOrderCents)} minimum order. Exact price shown before payment.
- Payment: card, Apple Pay, Google Pay, Interac e-Transfer (${etransfer.discountPercent}% off).
- Customers bring their own file, or find one through the site's model search.
- Contact: ${legal.contactEmail}, Instagram ${seo.instagram}

## Main pages

${link("Start an order", "/order", "upload a file and get a price")}
${link("Find a model", "/library", "search free and paid 3D models from several sites")}
${link("Questions", "/faq", "prices, files, materials, pickup and shipping")}
${link("About", "/about")}
${link("Gift cards", "/gift-cards")}

## What people print

${uses.map((u) => link(u.name, `/3d-printing/${u.slug}`, u.description)).join("\n")}

## Guides

${guides.map((g) => link(g.title, `/guides/${g.slug}`, g.description)).join("\n")}
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
