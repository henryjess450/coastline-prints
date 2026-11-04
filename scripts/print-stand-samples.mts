/**
 * Prints SAMPLE LightLab stand slips (a made-up order, nothing is saved) to
 * check the printer and the themes.
 *   npx tsx --conditions=react-server scripts/print-stand-samples.mts [printer-ip]
 * Options:
 *   --slip receipt|gift|claim   just one kind (default: all three)
 *   --market <id>               one of the example markets (default: holiday-market)
 *   --season <id>               christmas, halloween, coastline (plain)... (default: christmas)
 *   --all-seasons               one receipt per season (with --preview, for checking the art)
 *   --preview <folder>          save them as images (exactly as printed) instead of printing
 */
import "dotenv/config";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const previewDir = opt("preview");
const flagValues = new Set(["preview", "slip", "market", "season"].map(opt).filter(Boolean));
const host = args.find((a) => !a.startsWith("--") && !flagValues.has(a)) ?? process.env.RECEIPT_PRINTER_HOST;
if (!host && !previewDir) throw new Error("Pass the printer IP or set RECEIPT_PRINTER_HOST in .env");

const { renderStandSlipPng, sampleSlipData, STAND_SLIPS } = await import("../src/lib/receipt/stand");
const { EXAMPLE_MARKETS, SEASON_MESSAGES } = await import("../src/lib/receipt/themes");
const { seasons } = await import("../config/seasons");
const { pngToBitmap } = await import("../src/lib/receipt/bitmap");
const { encodeEscPos, encodeStar } = await import("../src/lib/receipt/escpos");
const { sendToPrinter } = await import("../src/lib/receipt/send");

const market = EXAMPLE_MARKETS.find((m) => m.id === (opt("market") ?? "holiday-market")) ?? null;
const slips = (opt("slip") ? [opt("slip")] : STAND_SLIPS) as (typeof STAND_SLIPS)[number][];
const runs = args.includes("--all-seasons")
  ? seasons.map((s) => ({ slip: "receipt" as const, season: s.id }))
  : slips.map((slip) => ({ slip, season: (opt("season") ?? "christmas") as (typeof seasons)[number]["id"] }));

const port = Number(process.env.RECEIPT_PRINTER_PORT ?? 9100);
for (const { slip, season } of runs) {
  const png = await renderStandSlipPng(slip, sampleSlipData(slip), { market, season, seasonMessage: SEASON_MESSAGES[season], footer: "Thanks for supporting a small Victoria maker!" });
  const bitmap = pngToBitmap(png);
  if (previewDir) {
    const { PNG } = await import("pngjs");
    const { writeFileSync } = await import("node:fs");
    const img = new PNG({ width: bitmap.widthBytes * 8, height: bitmap.heightDots });
    for (let y = 0; y < bitmap.heightDots; y++)
      for (let x = 0; x < img.width; x++) {
        const on = bitmap.data[y * bitmap.widthBytes + (x >> 3)] & (0x80 >> (x & 7));
        const i = (y * img.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = on ? 0 : 255;
        img.data[i + 3] = 255;
      }
    const file = `${previewDir}/stand-${slip}-${season}.png`;
    writeFileSync(file, PNG.sync.write(img));
    console.log(`Saved ${file}`);
    continue;
  }
  const bytes = process.env.RECEIPT_PRINTER_MODE === "escpos" ? encodeEscPos(bitmap) : encodeStar(bitmap);
  console.log(`Sending sample ${slip} (${season}, ${bitmap.heightDots} dot rows) to ${host}:${port} ...`);
  await sendToPrinter(bytes, host!, port);
}
console.log(previewDir ? "Done." : "Sent.");
