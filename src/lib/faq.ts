import { etransfer } from "@config/payments";
import { pickup } from "@config/pickup";
import { POINTS_PER_DOLLAR } from "@config/rewards";
import { seo, uploads } from "@config/site";
import type { AppConfig } from "@/lib/config/types";
import { money } from "@/lib/format";

export type Faq = {
  q: string;
  a: string;
  link?: { href: string; label: string };
  /** Also shown in the short list on the home page. */
  home?: boolean;
};

/**
 * Every question on /faq (and the short list on the home page). Numbers come
 * from config so the answers stay true when rates change.
 */
export function faqs(cfg: AppConfig): Faq[] {
  const p = cfg.pricing;
  const ship = cfg.shipping;
  const largest = Math.max(...cfg.printers.map((pr) => Math.min(pr.buildVolume.x, pr.buildVolume.y, pr.buildVolume.z))) - cfg.safetyMarginMm;
  const mat = (id: string) => cfg.materials.find((m) => m.id === id)?.description ?? "";
  const colours = Math.max(...cfg.printers.map((pr) => pr.maxColors));

  return [
    {
      q: "How much does 3D printing cost?",
      a: `Each order has a ${money(p.baseFeeCents)} order fee. Each part then costs ${p.pricePerGramCents}¢ per gram of filament plus ${money(p.pricePerHourCents)} per hour of printer time, and ${money(p.markupPerPieceCents)} per printed piece. The minimum order is ${money(p.minimumOrderCents)}. Upload your file to see the exact price before you pay.`,
      link: { href: "/#pricing", label: "Try the price slider" },
      home: true,
    },
    {
      q: `Where can I get something 3D printed in ${seo.city}?`,
      a: `Right here. Upload your file, see the price straight away, and pick it up in ${seo.neighbourhood} in 2 to 5 days, or have it shipped anywhere in Canada.`,
      link: { href: "/guides/where-to-get-something-3d-printed-victoria", label: "Compare your options" },
      home: true,
    },
    {
      q: "What files can I upload?",
      a: `STL (binary or ASCII) or 3MF files, up to ${uploads.maxFileMb} MB each and ${uploads.maxFilesPerOrder} files per order. 3MF projects from Bambu Studio, Orca Slicer and PrusaSlicer work, including painted colours. If your model is in another format, export it as STL or 3MF first.`,
      home: true,
    },
    {
      q: "I don't have a 3D file. Can I still order?",
      a: "Yes. Search thousands of free and paid models from Thingiverse, Printables, MakerWorld and other sites on the Find a model page, download the file, then upload it here.",
      link: { href: "/library", label: "Find a model" },
    },
    {
      q: "How long does it take?",
      a: `Most prints are ready in 2 to 5 days. The earliest pickup time you can book is ${pickup.minLeadDays} days after you order, and shipped orders go out once they're printed.`,
      home: true,
    },
    {
      q: "Where are you?",
      a: `${seo.neighbourhood}, ${seo.region}. Pickup is downtown; the exact address is shown after you pay and is in your confirmation email. Anywhere else in Canada, we ship.`,
      home: true,
    },
    {
      q: "Do you ship?",
      a: `Yes, anywhere in Canada with Canada Post. Small, flat prints can go in a padded bubble mailer by Lettermail (from ${money(ship.mailer.rates[0].priceCents + ship.mailer.packingFeeCents)}, no tracking). Anything else, or if you want tracking, goes in the smallest flat rate box it fits (from ${money(ship.boxes[0].priceCents + ship.packingFeePerBoxCents)}). Prices include packing.`,
      home: true,
    },
    {
      q: "Should I pick PLA, PETG or PLA-CF?",
      a: `PLA: ${mat("PLA")} PETG: ${mat("PETG")} PLA-CF: ${mat("PLA-CF")}`,
      link: { href: "/#materials", label: "See the colours" },
    },
    {
      q: "How big can you print?",
      a: `Up to ${largest} mm on each side in one piece. For anything bigger, split the model into parts in your slicer and upload each part as its own file.`,
    },
    {
      q: "Can you print in more than one colour?",
      a: `Yes, up to ${colours} colours in one part. Paint the model in Bambu Studio, Orca Slicer or PrusaSlicer and upload the 3MF. The price includes the extra filament used for colour changes, plus a ${money(cfg.multicolor.amsFeeCents)} fee per multicolour part.`,
    },
    {
      q: "Do I need to add supports?",
      a: "No. Supports are worked out from your model and included in the price. You can see them in the 3D preview by turning on Supports.",
    },
    {
      q: "My model showed up tiny. Why?",
      a: "It was probably modelled in inches. Press “Modelled in inches?” in the size panel and it will be multiplied by 25.4.",
      home: true,
    },
    {
      q: "How is the print time worked out?",
      a: "It's an estimate based on how much filament the part needs, the quality setting and the printer. The real time can be different. You pay the price shown at checkout either way.",
    },
    {
      q: "Which printers do you use?",
      a: "A Bambu Lab A1 Mini for smaller parts and an Elegoo Centauri Carbon for bigger parts and anything in PLA-CF. Each part is sent to the right printer automatically.",
    },
    {
      q: "Are there any discounts?",
      a: `Paying by Interac e-Transfer takes ${etransfer.discountPercent}% off. With an account you also earn ${POINTS_PER_DOLLAR} points for every $1 you spend, and trade them for money off.`,
      link: { href: "/rewards", label: "Rewards" },
    },
    {
      q: "Can I cancel?",
      a: "Yes, for a full refund, as long as printing hasn't started. After that the order can't be cancelled.",
      link: { href: "/terms", label: "Terms & Conditions" },
      home: true,
    },
    {
      q: "Will you print anything?",
      a: "Only files you have the right to use. No weapons or weapon parts, and nothing illegal. Orders like that are refunded and cancelled.",
      link: { href: "/terms", label: "Terms & Conditions" },
      home: true,
    },
  ];
}
