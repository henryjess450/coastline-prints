import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { GiftDesign } from "./designs";
import type { GiftData } from "./server";

/**
 * The gift card as a picture for the gift email: hand-lettered "Coastline
 * Prints" and "Gift Card", and the amount, number and
 * PIN in large type. 1050 × 662 (card proportions), shown at
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

/** Holly for the holiday card's corner: two leaves and three berries. */
const HOLLY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><path d="M30 26C22 14 10 12 2 16c6 2 6 8 2 12 8-2 14 2 16 8 2-6 6-8 10-10z" fill="#2f7d4a"/><path d="M34 26c8-12 20-14 28-10-6 2-6 8-2 12-8-2-14 2-16 8-2-6-6-8-10-10z" fill="#246b3d"/><circle cx="28" cy="28" r="6" fill="#e23b32"/><circle cx="38" cy="30" r="6" fill="#e23b32"/><circle cx="33" cy="20" r="6" fill="#ff5a4e"/></svg>`;
/** A six-armed snowflake. */
const FLAKE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24"><g stroke="#ffffff" stroke-width="2" stroke-linecap="round"><path d="M0-10V10M-8.7-5 8.7 5M-8.7 5 8.7-5"/></g></svg>`;
const svgUrl = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

function fonts() {
  const dir = path.resolve(/* turbopackIgnore: true */ root(), "assets/fonts");
  return [
    { name: "Montserrat", data: readFileSync(path.join(dir, "montserrat-latin-400-normal.woff")), weight: 400 as const, style: "normal" as const },
    { name: "Montserrat", data: readFileSync(path.join(dir, "montserrat-latin-600-normal.woff")), weight: 600 as const, style: "normal" as const },
  ];
}

/**
 * The gift card picture for the emails, in the card's design: navy, or red
 * with holly and snowflakes for the holidays.
 */
export async function renderGiftCardPng(g: Pick<GiftData, "amount" | "number" | "pin" | "recipientName"> & { design?: GiftDesign }) {
  const design = g.design ?? "coastline";
  const img = (rel: string, h: number, style: React.CSSProperties = {}, alt = "") => {
    const s = size(rel);
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={png(rel)} width={Math.round((s.w / s.h) * h)} height={h} alt={alt} style={style} />;
  };
  const holiday = design === "holiday";
  const tone = holiday ? { bg: "#a51d1d", label: "#f3c9c4" } : { bg: "#0e4471", label: "#a9c8e6" };
  const label = { fontSize: 22, color: tone.label, letterSpacing: 2, textTransform: "uppercase" } as const;
  const value = { fontSize: 40, fontWeight: 600, color: "#ffffff", letterSpacing: 1.5 } as const;

  const top = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {img("public/brand/lettering/coastline-prints-white.png", 74, {}, "Coastline Prints")}
      {img(holiday ? "public/brand/lettering/gift-card-gold.png" : "public/brand/lettering/gift-card-blue.png", 150, { marginTop: 24 }, "Gift Card")}
    </div>
  );

  const tree = (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: tone.bg, borderRadius: 48, padding: "64px 72px", fontFamily: "Montserrat", position: "relative", overflow: "hidden" }}>
      {holiday &&
        [
          // Kept to the empty right side, clear of the lettering and the numbers.
          [760, 250, 30],
          [700, 360, 18],
          [880, 330, 22],
          [960, 230, 16],
          [830, 200, 14],
        ].map(([x, y, s], i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={svgUrl(FLAKE)} width={s} height={s} alt="" style={{ position: "absolute", left: x, top: y, opacity: 0.35 }} />
        ))}
      {!holiday && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={svgUrl(MARK)} width={150} height={150} alt="" style={{ position: "absolute", right: 64, top: 52, borderRadius: 999, border: "8px solid rgba(255,255,255,0.3)" }} />
      )}
      {holiday && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={svgUrl(HOLLY)} width={200} height={150} alt="" style={{ position: "absolute", right: 56, top: 44 }} />
      )}
      {top}

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
