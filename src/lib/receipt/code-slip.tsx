import "server-only";
import { ImageResponse } from "next/og";
import { pickup } from "@config/pickup";
import { site } from "@config/site";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { loadFonts, RECEIPT_WIDTH, wordmark } from "./render";

const svg = (s: string) => `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`;

/** Two rows of black waves for the gift card's top and bottom bands. */
function waveBand(width: number) {
  const wave = (y: number, w: number) => {
    let d = `M0 ${y}`;
    for (let x = 0; x < width; x += 40) d += ` q10 -9 20 0 t20 0`;
    return `<path d="${d}" fill="none" stroke="black" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="34" viewBox="0 0 ${width} 34">${wave(11, 4)}${wave(25, 3)}</svg>`);
}

/** The circle wave mark in black and white. */
const mark = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="15" fill="black"/>
  <path d="M5 17c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0 2.2 2 2.2 2" stroke="white" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M7 22.5c1.8-1.5 3.6-1.5 5.4 0s3.6 1.5 5.4 0 3.6-1.5 5.4 0" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <circle cx="21.5" cy="10" r="3" fill="white"/></svg>`);

const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: pickup.timeZone, month: "long", day: "numeric", year: "numeric" }).format(d);

export async function renderCodeSlipPng(codeId: string) {
  const c = await db.promoCode.findUnique({ where: { id: codeId } });
  if (!c) throw new Error(`Code ${codeId} not found`);
  const fonts = loadFonts();
  const gift = c.kind === "GIFT_CARD";
  const w = RECEIPT_WIDTH;

  const tree = gift ? (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", width: "100%", height: "100%", background: "white", color: "black", fontFamily: fonts.family, padding: 4 }}>
      {/* Double frame, sized to its content so no paper is wasted */}
      <div style={{ display: "flex", border: "6px solid black", borderRadius: 26, padding: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, border: "2px solid black", borderRadius: 18, padding: "14px 18px", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={waveBand(w - 80)} width={w - 80} height={34} alt="" />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mark} width={84} height={84} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wordmark()} width={160} height={94} alt={site.name} />
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 14, marginTop: 14 }}>GIFT CARD</div>
          <div style={{ display: "flex", width: 120, height: 3, background: "black", marginTop: 8 }} />
          <div style={{ display: "flex", fontSize: 118, fontWeight: 700, lineHeight: 1, marginTop: 18, letterSpacing: -3 }}>{money(c.initialCents ?? 0)}</div>
          <div style={{ display: "flex", fontSize: 22, marginTop: 8 }}>to spend on custom 3D prints</div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "black", color: "white", borderRadius: 999, padding: "12px 34px", marginTop: 26 }}>
            <span style={{ fontSize: 15, letterSpacing: 4 }}>GIFT CARD CODE</span>
            <span style={{ fontSize: 33, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap" }}>{c.code}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: 20, marginTop: 22, textAlign: "center" }}>
            <span>Order at coastlineprints.ca and add this code under</span>
            <span style={{ fontWeight: 700 }}>&quot;Coupons or Gift Cards? Add them here!&quot;</span>
            <span style={{ marginTop: 8 }}>Use it over as many orders as you like until it runs out.</span>
            <span style={{ marginTop: 8, fontWeight: 700 }}>{c.expiresAt ? `Valid until ${fmtDate(c.expiresAt)}` : "Never expires"}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={waveBand(w - 80)} width={w - 80} height={34} alt="" style={{ marginTop: 18 }} />
        </div>
      </div>
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", width: "100%", height: "100%", background: "white", color: "black", fontFamily: fonts.family, padding: 4 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", border: "4px dashed black", borderRadius: 22, padding: "16px 20px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wordmark()} width={170} height={100} alt={site.name} />
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 12, marginTop: 6 }}>COUPON</div>
        <div style={{ display: "flex", fontSize: 104, fontWeight: 700, lineHeight: 1, marginTop: 12, letterSpacing: -2 }}>{c.kind === "PERCENT" ? `${c.percentOff}% OFF` : `${money(c.amountCents ?? 0)} OFF`}</div>
        <div style={{ display: "flex", fontSize: 22, marginTop: 6 }}>your custom 3D print order</div>
        <div style={{ display: "flex", justifyContent: "center", alignSelf: "stretch", background: "black", color: "white", borderRadius: 14, padding: "10px 0", marginTop: 18, fontSize: c.code.length > 14 ? 34 : 46, fontWeight: 700, letterSpacing: c.code.length > 14 ? 1 : 4, whiteSpace: "nowrap" }}>{c.code}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: 20, marginTop: 14, textAlign: "center" }}>
          <span>Add this code at checkout on coastlineprints.ca</span>
          {c.minOrderCents > 0 && <span>On orders of {money(c.minOrderCents)} or more</span>}
          {c.maxUses === 1 && <span>One-time use</span>}
          <span style={{ fontWeight: 700, marginTop: 4 }}>{c.expiresAt ? `Expires ${fmtDate(c.expiresAt)}` : "No expiry date"}</span>
        </div>
      </div>
    </div>
  );

  const res = new ImageResponse(tree, {
    width: w,
    height: gift ? 1100 : 800, // generous; blank space below the frame is trimmed before printing
    fonts: [
      { name: fonts.family, data: fonts.regular, weight: 400, style: "normal" },
      { name: fonts.family, data: fonts.bold, weight: 700, style: "normal" },
    ],
  });
  return { png: Buffer.from(await res.arrayBuffer()), code: c.code };
}
