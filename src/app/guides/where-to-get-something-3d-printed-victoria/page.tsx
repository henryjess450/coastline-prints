import type { Metadata } from "next";
import Link from "next/link";
import { GuidePage, GuideTable } from "@/components/guides/GuidePage";
import { getEffectiveConfig } from "@/lib/config/effective";
import { money } from "@/lib/format";
import { findGuide } from "@/lib/guides";

const guide = findGuide("where-to-get-something-3d-printed-victoria");
export const metadata: Metadata = { title: guide.title, description: guide.description, alternates: { canonical: `/guides/${guide.slug}` } };
export const dynamic = "force-dynamic"; // quotes live rates

/**
 * An honest comparison of the ways to get a print in Victoria. Keep the other
 * options fair and current; check their pages when updating this guide.
 */
export default async function WhereGuide() {
  const p = (await getEffectiveConfig()).pricing;
  return (
    <GuidePage
      guide={guide}
      answer={
        <p>
          The quickest way is to order online from a local print shop like Coastline Prints: upload your STL or 3MF, see the price right away, and pick it up downtown in 2 to 5 days. UVic students can also use the library&apos;s 3D
          printing service, and online networks handle industrial materials like nylon and metal.
        </p>
      }
    >
      <h2>Your options at a glance</h2>
      <GuideTable
        head={["", "Price", "Speed", "Good for"]}
        rows={[
          ["Local online print shop (Coastline Prints)", "Instant, shown before you pay", "2 to 5 days, pickup downtown or shipped", "Everyday parts, gifts, cosplay, terrain, small batches"],
          ["UVic library (Digital Scholarship Commons)", "Staff quote after you upload", "First come, first served", "Academic and personal projects; no commercial work"],
          ["Online manufacturing networks", "Instant, plus shipping", "Varies, shipped from wherever it's made", "Engineering materials: nylon, resin, metal"],
          ["Buying your own printer", "A few hundred dollars and up", "Same day, once you've learned it", "People who print every week"],
        ]}
      />

      <h2>1. A local print shop that prices online</h2>
      <p>
        This is what <Link href="/">Coastline Prints</Link> does. You upload a file, scale it in the 3D preview, pick PLA, PETG or carbon fibre PLA and a colour, and the price appears straight away. The order fee is{" "}
        {money(p.baseFeeCents)} and the minimum order is {money(p.minimumOrderCents)}; most small prints land between {money(p.minimumOrderCents)} and about $15. Pickup is in downtown Victoria, or it&apos;s shipped anywhere in Canada.
       
      </p>

      <h2>2. UVic Libraries</h2>
      <p>
        The University of Victoria&apos;s Digital Scholarship Commons, on the third floor of the McPherson Library, runs a 3D printing service. You upload an STL or OBJ, staff work out the cost, and once you accept and pay, your print
        joins the queue. Prints are picked up at the McPherson Library front desk. It&apos;s for academic, personal and prototyping projects, not commercial ones. Check their guide for who can use it and the current rules.
      </p>

      <h2>3. Public libraries</h2>
      <p>Some BC library systems have run 3D printing services at times. Rules, costs and wait times change, so ask your local branch before counting on it.</p>

      <h2>4. Online manufacturing networks</h2>
      <p>
        Big online networks send your file to one of many partner shops, often outside BC. They make sense for materials a hobby printer can&apos;t do, like SLS nylon, resin or metal. For everyday plastic parts they&apos;re usually
        slower and cost more once shipping is added.
      </p>

      <h2>5. Buying your own printer</h2>
      <p>
        If you&apos;ll print every week, a printer of your own pays for itself. For a few parts a year, ordering is cheaper and skips the learning curve. Our guide on <Link href="/guides/3d-printing-cost">3D printing cost</Link> shows
        what typical parts cost.
      </p>

      <h2>Don&apos;t have a file yet?</h2>
      <p>
        You need an STL or 3MF file wherever you print. See <Link href="/guides/how-to-get-an-stl-file">how to get an STL file</Link>, or search free models on our <Link href="/library">Find a model</Link> page.
      </p>
    </GuidePage>
  );
}
