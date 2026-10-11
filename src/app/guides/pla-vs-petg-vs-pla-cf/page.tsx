import type { Metadata } from "next";
import Link from "next/link";
import { GuidePage, GuideTable } from "@/components/guides/GuidePage";
import { getEffectiveConfig } from "@/lib/config/effective";
import { findGuide } from "@/lib/guides";

const guide = findGuide("pla-vs-petg-vs-pla-cf");
export const metadata: Metadata = { title: guide.title, description: guide.description, alternates: { canonical: `/guides/${guide.slug}` } };
export const dynamic = "force-dynamic"; // colour counts come from stock

export default async function MaterialsGuide() {
  const cfg = await getEffectiveConfig();
  const count = (id: string) => cfg.materials.find((m) => m.id === id)?.colors.filter((c) => c.available).length ?? 0;

  return (
    <GuidePage
      guide={guide}
      answer={
        <p>
          Pick <strong>PLA</strong> for figures, gifts and anything for display. Pick <strong>PETG</strong> for parts that get used: clips, brackets, anything that sits in a hot car or needs to bend a little. Pick{" "}
          <strong>PLA-CF</strong> (carbon fibre PLA) for stiff, clean-looking parts like enclosures and mounts. All three cost the same per gram here.
        </p>
      }
    >
      <h2>PLA vs PETG vs PLA-CF compared</h2>
      <GuideTable
        head={["", "PLA", "PETG", "PLA-CF"]}
        rows={[
          ["Strength", "Stiff but brittle, snaps when bent", "Tough, bends before it breaks", "Stiffest, still snaps if overloaded"],
          ["Heat", "Softens around 55 to 60 °C", "Softens around 70 to 80 °C", "Softens around 55 to 60 °C"],
          ["Finish", "Smooth, most colours, silk and matte options", "Glossy, some see-through colours", "Matte, hides layer lines well"],
          ["Detail", "Sharpest", "Good", "Good"],
          ["Outdoors", "Fine for a while, fades and softens in sun", "Better in sun and rain", "Like PLA"],
          ["Colours in stock", `${count("PLA")}`, `${count("PETG")}`, `${count("PLA-CF")}`],
        ]}
      />

      <h2>PLA</h2>
      <p>
        PLA is the standard 3D printing plastic. It holds fine detail, comes in the most colours, and is easy to sand and paint. Its weak spot is heat: a PLA part left on a car dashboard in summer can warp. Use it for figures,
        cosplay, tabletop terrain, planters and gifts.
      </p>

      <h2>PETG</h2>
      <p>
        PETG is the same family of plastic as water bottles. It&apos;s tougher than PLA, flexes a little instead of snapping, and handles more heat and sun. Use it for{" "}
        <Link href="/3d-printing/replacement-parts">replacement parts</Link>, clips, hooks, outdoor pieces and anything that clicks together.
      </p>

      <h2>PLA-CF</h2>
      <p>
        PLA-CF is PLA with short carbon fibres mixed in. The fibres make it stiffer and give it a matte surface that hides layer lines, so parts look clean straight off the printer. It needs a hardened nozzle, so it&apos;s printed on our
        Elegoo Centauri Carbon. Use it for <Link href="/3d-printing/prototypes-small-batch">enclosures, mounts and brackets</Link> that should not flex.
      </p>

      <h2>PLA vs PETG strength</h2>
      <p>
        PLA is stiffer, so it feels more solid in your hand, but it snaps when bent too far. PETG gives a little and bends before it breaks, which makes it the stronger choice for clips, hinges and anything that takes a knock.
        Carbon fibre PLA is the stiffest of the three for parts that must not flex.
      </p>

      <h2>PLA vs PETG heat resistance</h2>
      <p>
        PLA starts to soften around 55 to 60 °C, which a car interior can reach on a sunny summer day. PETG holds its shape to around 70 to 80 °C. For anything in a car, near a heater or outside in the sun, pick PETG.
      </p>

      <h2>What about ABS?</h2>
      <p>
        ABS handles more heat than PETG, but it isn&apos;t one of our materials. For almost every everyday part, PETG does the job.
      </p>

      <h2>Still not sure?</h2>
      <p>
        Upload your file and switch between materials in the order screen. The price updates as you go, and you can <Link href="/#materials">see each colour on a sample print</Link> on the home page.
      </p>
    </GuidePage>
  );
}
