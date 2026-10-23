/**
 * Renders every shipping label design with sample details, plus a PDF and the
 * alignment test, into storage/label-samples/. Run:
 *   npx tsx --conditions=react-server scripts/label-samples.mts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { labels } from "../config/labels";
import { sampleLabel } from "../src/lib/label/data";
import { renderAlignmentPdf, renderLabelPdf, renderLabelPng } from "../src/lib/label/render";

const out = "storage/label-samples";
mkdirSync(out, { recursive: true });
const long = { ...sampleLabel(), to: { name: "Alexandre Beaulieu-Fontaine", street: ["Apt 1207", "2201 Boul De Maisonneuve O"], city: "Montréal QC", postal: "H3H 1L5" }, email: "alexandre.beaulieu@example.com", service: "Medium flat rate box, tracked", postage: "PREPAID", pkg: { n: 2, of: 2, name: "Medium" } };
for (const d of labels.designs) {
  writeFileSync(`${out}/${d.id}.png`, await renderLabelPng(d.id, sampleLabel()));
  writeFileSync(`${out}/${d.id}-long.png`, await renderLabelPng(d.id, long));
}
writeFileSync(`${out}/sheet.pdf`, await renderLabelPdf("harbour", [sampleLabel(), long], 3));
writeFileSync(`${out}/alignment.pdf`, await renderAlignmentPdf());
console.log(`Wrote ${out}/`);
