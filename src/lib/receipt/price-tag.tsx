import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { appUrl } from "@/lib/email/data";
import sharp from "sharp";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { toProductDto } from "@/lib/shop/products.server";
import { standFonts } from "./stand";

/*
 * Price tags for the market stand, in the owner's design: a thin border, the
 * product's line drawing on the left, and on the right the shop's logo, the
 * name in its own colours (one colour, or a gradient across the letters) and
 * the price. Printed from a PDF at real size (Admin > Price tags), for
 * LightLab and Coastline products alike.
 */

/** Tag size and print sharpness. */
export const TAG_DPI = 300;
export const TAG_SIZE_KEY = "price-tags";
export type TagSize = { widthIn: number; heightIn: number };
export const DEFAULT_TAG_SIZE: TagSize = { widthIn: 4, heightIn: 1.9 };

export async function getTagSize(): Promise<TagSize> {
  const row = await db.setting.findUnique({ where: { key: TAG_SIZE_KEY } });
  try {
    const v = row ? (JSON.parse(row.value) as TagSize) : null;
    if (v && v.widthIn >= 1.5 && v.widthIn <= 8 && v.heightIn >= 1 && v.heightIn <= 6) return v;
  } catch {}
  return DEFAULT_TAG_SIZE;
}

export type TagLook = {
  shop: "lightlab" | "coastline";
  name: string;
  /** "$40", or "from $40" when options cost different amounts. */
  price: string;
  /** Storage key of the drawing, or null for none yet. */
  image: string | null;
  colors: string[];
  priceColor: string | null;
  /** The product's page, as a small QR code in the corner (scans tagged as from a price tag). */
  url: string;
};

const hex = (s: string) => /^#[0-9a-f]{6}$/i.test(s);
export const cleanColors = (list: unknown): string[] => (Array.isArray(list) ? list.filter((c): c is string => typeof c === "string" && hex(c)).slice(0, 4) : []);

/** A product's tag as saved (colours and drawing from the product). */
export async function tagLookFor(productId: string): Promise<TagLook | null> {
  const row = await db.shopProduct.findUnique({ where: { id: productId } });
  if (!row) return null;
  const p = toProductDto(row);
  const prices = p.variants.length ? p.variants.map((v) => v.priceCents ?? p.priceCents) : [p.priceCents];
  const low = Math.min(...prices);
  const dollars = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
  return {
    shop: row.shop === "coastline" ? "coastline" : "lightlab",
    name: p.name,
    price: new Set(prices).size > 1 ? `from ${dollars(low)}` : dollars(low),
    image: row.tagImage,
    colors: cleanColors(JSON.parse(row.tagColors)),
    priceColor: row.tagPriceColor && hex(row.tagPriceColor) ? row.tagPriceColor : null,
    url: `${appUrl()}/${row.shop === "coastline" ? "shop" : "lightlab"}/${p.slug}?utm_source=market&utm_medium=price-tag`,
  };
}

/** The drawing as a PNG data URI, trimmed of empty margins so it fills its side of the tag. */
async function drawing(key: string | null) {
  if (!key) return null;
  const file = await getStorage().get(key).catch(() => null);
  if (!file) return null;
  const png = await sharp(Buffer.from(file)).flatten({ background: "#ffffff" }).trim({ threshold: 20 }).png().toBuffer({ resolveWithObject: true });
  return { src: `data:image/png;base64,${png.data.toString("base64")}`, w: png.info.width, h: png.info.height };
}

let coastlineMark: string | null = null;
const coastlineLogo = () => (coastlineMark ??= `data:image/png;base64,${readFileSync(path.resolve(/* turbopackIgnore: true */ process.cwd(), "public/brand/wordmark-black.png")).toString("base64")}`);

/** The tag as a colour PNG at print resolution (or `scale` × that, for quick previews). */
export async function renderTagPng(t: TagLook, size: TagSize, scale = 1): Promise<Buffer> {
  const W = Math.round(size.widthIn * TAG_DPI * scale);
  const H = Math.round(size.heightIn * TAG_DPI * scale);
  const u = H / 100; // layout units: 1% of the tag's height
  const art = await drawing(t.image);
  const qr = await QRCode.toString(t.url, { type: "svg", margin: 0, errorCorrectionLevel: "L", color: { dark: "#111111", light: "#ffffff" } });
  const colors = t.colors.length ? t.colors : ["#111111"];
  const priceColor = t.priceColor ?? colors[colors.length - 1];
  // Long names get smaller so they stay on one line.
  const nameSize = Math.min(23 * u, (W * 0.52) / Math.max(4, t.name.length * 0.55));
  const nameStyle =
    colors.length > 1
      ? { backgroundImage: `linear-gradient(90deg, ${colors.join(", ")})`, backgroundClip: "text" as const, color: "transparent" }
      : { color: colors[0] };
  const artBox = { w: W * 0.4, h: H * 0.86 };
  const fit = art ? Math.min(artBox.w / art.w, artBox.h / art.h) : 1;

  const tree = (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "white", border: `${Math.max(1, Math.round(0.6 * u))}px solid #222`, fontFamily: "Gabarito" }}>
      <div style={{ display: "flex", width: "45%", height: "100%", alignItems: "center", justifyContent: "center" }}>
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art.src} width={Math.round(art.w * fit)} height={Math.round(art.h * fit)} alt="" />
        ) : (
          <div style={{ display: "flex", fontSize: 5 * u, color: "#bbb" }}>Add a drawing</div>
        )}
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: `${7 * u}px ${4 * u}px ${9 * u}px` }}>
        {t.shop === "lightlab" ? (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 0.95 }}>
            <span style={{ fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 10 * u, color: "#111" }}>light</span>
            <span style={{ fontSize: 9.5 * u, fontWeight: 800, color: "#111", marginTop: -0.8 * u }}>lab.</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coastlineLogo()} width={Math.round(17 * u * 1.7)} height={Math.round(17 * u)} alt="" />
        )}
        <span style={{ ...nameStyle, fontSize: nameSize, fontWeight: 800, letterSpacing: -0.045 * nameSize, lineHeight: 1.05 }}>{t.name}</span>
        <span style={{ fontSize: 15 * u, fontWeight: 800, color: priceColor, letterSpacing: -0.6 * u, marginRight: 16 * u }}>{t.price}</span>
      </div>
      {/* Small QR in the corner: scan to order online. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", right: 3.5 * u, bottom: 3.5 * u }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;base64,${Buffer.from(qr).toString("base64")}`} width={Math.round(17 * u)} height={Math.round(17 * u)} alt="" />
        <span style={{ fontSize: 3.6 * u, fontWeight: 800, color: "#111", marginTop: 0.8 * u, letterSpacing: 0.1 * u }}>ORDER ONLINE</span>
      </div>
    </div>
  );
  const res = new ImageResponse(tree, { width: W, height: H, fonts: standFonts() });
  return Buffer.from(await res.arrayBuffer());
}
