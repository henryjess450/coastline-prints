import "server-only";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getStorage } from "@/lib/storage";
import type { TagLook } from "./price-tag";
import { standFonts } from "./stand";

/*
 * The price tag for the little screen at the stand: a 1.5" 128x128 OLED with
 * an SH1107 (black and white) on an ESP32, loaded over USB from Admin > Price
 * tags (firmware/pricetag). White on black, since a lit OLED pixel is the ink:
 * the drawing as big as it fits, then the name and the price. No logo: the
 * screen is too small to spare the room. Sent as 16 greys; the board lights
 * anything half bright or more.
 */

export const OLED_SIZE = 128;
const SCALE = 4; // drawn at 512px, then shrunk, so text edges get the in-between greys

/** The drawing as white lines on black, trimmed to its edges. */
async function drawing(key: string | null) {
  if (!key) return null;
  const file = await getStorage().get(key).catch(() => null);
  if (!file) return null;
  const png = await sharp(Buffer.from(file)).flatten({ background: "#ffffff" }).trim({ threshold: 20 }).greyscale().negate({ alpha: false }).png().toBuffer({ resolveWithObject: true });
  return { src: `data:image/png;base64,${png.data.toString("base64")}`, w: png.info.width, h: png.info.height };
}

/** 128x128 greys (one byte a pixel, 0 = off) for a tag. */
async function renderGreys(t: TagLook): Promise<Buffer> {
  const S = OLED_SIZE * SCALE;
  const u = S / 100;
  const art = await drawing(t.image);
  const artBox = { w: 96 * u, h: 56 * u };
  const fit = art ? Math.min(artBox.w / art.w, artBox.h / art.h) : 1;
  if (!art) return renderGreysTextOnly(t);
  const nameSize = Math.min(17 * u, (97 * u) / Math.max(4, t.name.length * 0.55));
  const priceSize = Math.min(24 * u, (97 * u) / Math.max(3, t.price.length * 0.6));

  const tree = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "100%", background: "black", color: "white", fontFamily: "Gabarito", padding: `${2 * u}px ${1.5 * u}px ${1 * u}px` }}>
      <div style={{ display: "flex", flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art.src} width={Math.round(art.w * fit)} height={Math.round(art.h * fit)} alt="" />
      </div>
      <span style={{ fontSize: nameSize, fontWeight: 800, letterSpacing: -0.03 * nameSize, lineHeight: 1.05, textAlign: "center" }}>{t.name}</span>
      <span style={{ fontSize: priceSize, fontWeight: 800, letterSpacing: -0.03 * priceSize, lineHeight: 1 }}>{t.price}</span>
    </div>
  );
  return toGreys(tree);
}

/**
 * No drawing yet: the name and price alone, centred and as big as they fit,
 * so they read from across the stand. The name may wrap onto a few lines.
 */
async function renderGreysTextOnly(t: TagLook): Promise<Buffer> {
  const u = (OLED_SIZE * SCALE) / 100;
  const W = 96 * u;
  const longestWord = Math.max(...t.name.split(/\s+/).map((w) => w.length), 3);
  let nameSize = Math.min(30 * u, W / (longestWord * 0.6));
  const priceSize = Math.min(40 * u, W / Math.max(3, t.price.length * 0.6));
  // Shrink the name until its lines and the price fit the height.
  const lines = (size: number) => {
    // Wrap word by word, as the browser will (about 0.6em a letter).
    let n = 1;
    let used = 0;
    for (const word of t.name.split(/\s+/)) {
      const w = word.length * 0.6 * size;
      if (used && used + 0.3 * size + w > W) {
        n++;
        used = w;
      } else used += (used ? 0.3 * size : 0) + w;
    }
    return n;
  };
  while (nameSize > 8 * u && lines(nameSize) * nameSize * 1.05 + priceSize * 1.1 + 12 * u > 96 * u) nameSize -= u;

  return toGreys(
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", background: "black", color: "white", fontFamily: "Gabarito", padding: `${2 * u}px` }}>
      <span style={{ fontSize: nameSize, fontWeight: 800, letterSpacing: -0.03 * nameSize, lineHeight: 1.05, textAlign: "center" }}>{t.name}</span>
      <span style={{ fontSize: priceSize, fontWeight: 800, letterSpacing: -0.03 * priceSize, lineHeight: 1.1, marginTop: 4 * u }}>{t.price}</span>
    </div>,
  );
}

async function toGreys(tree: React.ReactElement): Promise<Buffer> {
  const S = OLED_SIZE * SCALE;
  const png = Buffer.from(await new ImageResponse(tree, { width: S, height: S, fonts: standFonts() }).arrayBuffer());
  return sharp(png).flatten({ background: "#000000" }).resize(OLED_SIZE, OLED_SIZE, { kernel: "lanczos3" }).greyscale().raw().toBuffer();
}

/** What the board takes: 4 bits a pixel, left pixel in the high nibble (8192 bytes). */
export function packOled(greys: Buffer): Buffer {
  const out = Buffer.alloc((OLED_SIZE * OLED_SIZE) / 2);
  for (let i = 0; i < out.length; i++) out[i] = ((greys[i * 2] >> 4) << 4) | (greys[i * 2 + 1] >> 4);
  return out;
}

/** A preview of exactly what the screen shows (black and white), blown up with square pixels. */
export async function oledPreviewPng(packed: Buffer, zoom = 3): Promise<Buffer> {
  const greys = Buffer.alloc(OLED_SIZE * OLED_SIZE);
  for (let i = 0; i < packed.length; i++) {
    greys[i * 2] = packed[i] >> 4 >= 8 ? 255 : 0;
    greys[i * 2 + 1] = (packed[i] & 15) >= 8 ? 255 : 0;
  }
  return sharp(greys, { raw: { width: OLED_SIZE, height: OLED_SIZE, channels: 1 } }).resize(OLED_SIZE * zoom, OLED_SIZE * zoom, { kernel: "nearest" }).png().toBuffer();
}

export async function renderOledTag(t: TagLook): Promise<Buffer> {
  return packOled(await renderGreys(t));
}
