import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { GiftData } from "./server";

/**
 * The gift card as a picture for the gift email: navy card, hand-lettered
 * "Coastline Prints" and "Gift Card", the circle mark, and the amount,
 * number and PIN in large type. 1050 × 662 (card proportions), shown at
 * about half size in the email so it stays sharp on phones.
 */
export const CARD_W = 1050;
export const CARD_H = 662;

const root = () => process.cwd();
const png = (rel: string) => `data:image/png;base64,${readFileSync(path.resolve(/* turbopackIgnore: true */ root(), rel)).toString("base64")}`;
const size = (rel: string) => {
  const buf = readFileSync(path.resolve(/* turbopackIgnore: true */ root(), rel));
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#0e4471"/><path d="M5 17c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0 2.2 2 2.2 2" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M7 22.5c1.8-1.5 3.6-1.5 5.4 0s3.6 1.5 5.4 0 3.6-1.5 5.4 0" stroke="#86bbea" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="21.5" cy="10" r="3" fill="#e9c46a"/></svg>`;

function fonts() {
  const dir = path.resolve(/* turbopackIgnore: true */ root(), "assets/fonts");
  return [
    { name: "Montserrat", data: readFileSync(path.join(dir, "montserrat-latin-400-normal.woff")), weight: 400 as const, style: "normal" as const },
    { name: "Montserrat", data: readFileSync(path.join(dir, "montserrat-latin-600-normal.woff")), weight: 600 as const, style: "normal" as const },
  ];
}

export async function renderGiftCardPng(g: Pick<GiftData, "amount" | "number" | "pin" | "recipientName">) {
  const name = "public/brand/lettering/coastline-prints-white.png";
  const gift = "public/brand/lettering/gift-card-blue.png";
  const nameH = 74;
  const giftH = 150;
  const n = size(name);
  const gsz = size(gift);
  const label = { fontSize: 22, color: "#a9c8e6", letterSpacing: 2, textTransform: "uppercase" } as const;
  const value = { fontSize: 40, fontWeight: 600, color: "#ffffff", letterSpacing: 1.5 } as const;

  const tree = (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0e4471", borderRadius: 48, padding: "64px 72px", fontFamily: "Montserrat", position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`} width={150} height={150} alt="" style={{ position: "absolute", right: 64, top: 52, borderRadius: 999, border: "8px solid rgba(255,255,255,0.3)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={png(name)} width={Math.round((n.w / n.h) * nameH)} height={nameH} alt="Coastline Prints" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={png(gift)} width={Math.round((gsz.w / gsz.h) * giftH)} height={giftH} alt="Gift Card" style={{ marginTop: 24 }} />

      <div style={{ display: "flex", marginTop: "auto", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={label}>Card number</span>
          <span style={value}>{g.number}</span>
          <span style={{ ...label, marginTop: 14 }}>PIN</span>
          <span style={value}>{g.pin}</span>
        </div>
        <span style={{ fontSize: 72, fontWeight: 600, color: "#e9c46a" }}>{g.amount}</span>
      </div>
    </div>
  );

  const res = new ImageResponse(tree, { width: CARD_W, height: CARD_H, fonts: fonts() });
  return Buffer.from(await res.arrayBuffer());
}
