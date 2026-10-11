import type { Metadata } from "next";
import Link from "next/link";
import { etransfer } from "@config/payments";
import { GuidePage, GuideTable } from "@/components/guides/GuidePage";
import type { AppConfig } from "@/lib/config/types";
import { getEffectiveConfig } from "@/lib/config/effective";
import { hours, money } from "@/lib/format";
import { findGuide } from "@/lib/guides";
import { quoteOrder } from "@/lib/pricing/quote";

const guide = findGuide("3d-printing-cost");
export const metadata: Metadata = { title: guide.title, description: guide.description, alternates: { canonical: `/guides/${guide.slug}` } };
export const dynamic = "force-dynamic"; // prices come from today's rates

/** Prices a cube with the same engine as checkout. */
function cube(cfg: AppConfig, side: number, quantity = 1, material: "PLA" | "PETG" = "PLA") {
  const colorId = cfg.materials.find((m) => m.id === material)?.colors.find((c) => c.available && c.pricePerGramCents == null)?.id ?? "";
  const q = quoteOrder([{ size: { x: side, y: side, z: side }, volumeMm3: side ** 3, surfaceAreaMm2: 6 * side ** 2, material, colorId, quality: "standard", infill: "standard", quantity }], cfg);
  const item = q.items[0];
  return item.ok ? { ok: true as const, total: q.totalCents, grams: item.gramsEach, time: item.hoursTotal } : { ok: false as const, total: 0, grams: 0, time: 0 };
}

export default async function CostGuide() {
  const cfg = await getEffectiveConfig();
  const p = cfg.pricing;
  // Sizes that fit within the longest single print we take, so every row is a real price.
  const rows = [20, 30, 40, 50, 60, 80, 100]
    .map((s) => ({ s, c: cube(cfg, s) }))
    .filter(({ c }) => c.ok)
    .map(({ s, c }) => [`${s} mm cube`, `${Math.round(c.grams)} g`, hours(c.time), money(c.total)]);
  const one = cube(cfg, 30);
  const ten = cube(cfg, 30, 10);

  return (
    <GuidePage
      guide={guide}
      answer={
        <p>
          At Coastline Prints in downtown Victoria, most small prints cost between {money(p.minimumOrderCents)} (the minimum order) and about {money(cube(cfg, 60).total)}. You pay a{" "}
          {money(p.baseFeeCents)} order fee, {p.pricePerGramCents}¢ per gram of plastic, {money(p.pricePerHourCents)} per hour of printing, and {money(p.markupPerPieceCents)} per piece.
        </p>
      }
    >
      <h2>3D printing cost per gram and per hour</h2>
      <ul>
        <li>
          <strong>Order fee, {money(p.baseFeeCents)}.</strong> Once per order, no matter how many parts are in it.
        </li>
        <li>
          <strong>Filament, {p.pricePerGramCents}¢ per gram.</strong> The plastic itself. A golf ball weighs about 45 g, for scale. Specialty spools like wood fill cost a little more.
        </li>
        <li>
          <strong>Printer time, {money(p.pricePerHourCents)} per hour.</strong> Power, wear and parts for the printer.
        </li>
        <li>
          <strong>{money(p.markupPerPieceCents)} per piece.</strong> For handling each printed part.
        </li>
      </ul>
      <p>The minimum order is {money(p.minimumOrderCents)}. If your parts add up to less, the total is topped up to the minimum.</p>

      <h2>3D printing cost calculator</h2>
      <p>
        You don&apos;t need a spreadsheet. The <Link href="/#pricing">price slider</Link> on the home page prices any size of cube as you drag, and the <Link href="/order">order page</Link> works as a full 3D printing cost
        calculator for your own file: upload an STL or 3MF, change the size, material, quality and quantity, and the price updates live. Nothing is charged until you check out.
      </p>

      <h2>Example prices by size</h2>
      <p>These come from the same pricing as checkout, using today&apos;s rates, for one cube in PLA at standard quality and infill. Most real models cost less than a cube of the same height, because a cube fills its whole box.</p>
      <GuideTable head={["Part", "Filament", "Print time", "Total"]} rows={rows} />

      <h2>Is 3D printing expensive?</h2>
      <p>Not for small parts. Most of a small order is the order fee, and the plastic itself is cheap: a part the size of a golf ball uses about a dollar of filament. Big, solid or long prints cost more because they use hours of printer time.</p>

      <h2>Ordering more than one</h2>
      <p>
        The order fee is only charged once, so the price per part drops as you order more. One 30 mm cube costs {money(one.total)}. Ten of them cost {money(ten.total)}, or {money(Math.round(ten.total / 10))} each.
      </p>

      <h2>How to make a print cheaper</h2>
      <ul>
        <li>Put everything in one order, so you pay the order fee once.</li>
        <li>Scale the model down a little. Plastic use drops fast as size shrinks, because it goes with the volume.</li>
        <li>Pick a lighter infill if the part doesn&apos;t need to be strong.</li>
        <li>Pay by Interac e-Transfer for {etransfer.discountPercent}% off.</li>
        <li>A small part on its own is mostly order fee. Add a second small part to the same order and it often costs only a dollar or two more.</li>
      </ul>

      <h2>Pickup or shipping</h2>
      <p>
        Pickup in downtown Victoria is free. Shipping anywhere in Canada is added at checkout, from{" "}
        {money(cfg.shipping.mailer.rates[0].priceCents + cfg.shipping.mailer.packingFeeCents)} for a small flat print in a bubble mailer. All prices are in Canadian dollars.
      </p>
    </GuidePage>
  );
}
