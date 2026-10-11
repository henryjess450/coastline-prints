import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { lightlab } from "@config/lightlab";
import { getStorage } from "@/lib/storage";
import { SHARE_SIZE } from "@/lib/og/share-card";

const BLUE = "#297f9d";

let assets: { logo: string; sans: Buffer; bold: Buffer; serif: Buffer } | null = null;
function load() {
  // Read once; runtime paths, so the bundler doesn't trace the whole project.
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd());
  assets ??= {
    logo: `data:image/png;base64,${readFileSync(path.join(root, "public/brand/lightlab-logo-dark.png")).toString("base64")}`,
    sans: readFileSync(path.join(root, "assets/fonts/gabarito-latin-400-normal.woff")),
    bold: readFileSync(path.join(root, "assets/fonts/gabarito-latin-800-normal.woff")),
    serif: readFileSync(path.join(root, "assets/fonts/instrument-serif-latin-400-italic.woff")),
  };
  return assets;
}

/**
 * A product photo as a data URI the image renderer can draw. JPG and PNG go
 * straight in; WebP is converted. Null if it can't be read (the card then
 * shows without a photo rather than failing).
 */
async function photo(key: string | undefined) {
  if (!key) return null;
  try {
    const data = Buffer.from(await getStorage().get(key));
    if (key.endsWith(".jpg")) return `data:image/jpeg;base64,${data.toString("base64")}`;
    if (key.endsWith(".png")) return `data:image/png;base64,${data.toString("base64")}`;
    const sharp = (await import("sharp")).default;
    return `data:image/png;base64,${(await sharp(data).png().toBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * The picture shown when a LightLab link is shared: black and white with the
 * logo blue, the product photo on the left when there is one.
 */
export async function lightlabShareCard({ title, line, price, imageKey }: { title: string; line?: string; price?: string; imageKey?: string }) {
  const { logo, sans, bold, serif } = load();
  const img = await photo(imageKey);
  const H = SHARE_SIZE.height;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "Gabarito" }}>
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} width={H} height={H} alt="" style={{ objectFit: "cover" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: img ? "56px 56px 52px" : "72px 88px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={img ? 260 : 380} height={img ? 102 : 149} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: img ? 60 : 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{title}</div>
            {line && <div style={{ fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: img ? 38 : 46, color: BLUE, marginTop: 12, lineHeight: 1.1 }}>{line}</div>}
            {price && <div style={{ fontSize: 46, fontWeight: 800, marginTop: 26 }}>{price}</div>}
          </div>
          <div style={{ fontSize: 22, color: "#a3a3a3" }}>{`${lightlab.name} · novelty lamps`}</div>
        </div>
      </div>
    ),
    {
      ...SHARE_SIZE,
      fonts: [
        { name: "Gabarito", data: sans, weight: 400, style: "normal" },
        { name: "Gabarito", data: bold, weight: 800, style: "normal" },
        { name: "Instrument Serif", data: serif, weight: 400, style: "italic" },
      ],
    },
  );
}
