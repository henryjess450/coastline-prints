import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import type { SeasonId } from "@config/seasons";
import { pickup } from "@config/pickup";
import { legal } from "@config/site";
import { lightlab } from "@config/lightlab";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import { money } from "@/lib/format";
import { comebackCouponFor } from "@/lib/codes/comeback";
import { formatCardNumber } from "@/lib/codes/apply";
import { artUri, scissors, lampRow, marketBand, seasonBottom, seasonTop, type Art } from "./art";
import { loadReceiptData, orderBarcode, RECEIPT_WIDTH } from "./render";
import { findMarket, getPrintSettings, receiptSeason, seasonMessage } from "./settings";
import type { Market } from "./themes";

/**
 * Slips for the customer at the LightLab stand, themed for the market the
 * stand is at and the season:
 *   receipt  what they bought and paid
 *   gift     the same without prices, to tuck in with a present
 *   claim    an order ticket for something made later (Start order):
 *            the day it's ready and a QR code to check on it
 */
export const STAND_SLIPS = ["receipt", "gift", "claim"] as const;
export type StandSlip = (typeof STAND_SLIPS)[number];
export const STAND_SLIP_NAMES: Record<StandSlip, string> = { receipt: "Receipt", gift: "Gift receipt", claim: "Order ticket" };

export type StandSlipData = {
  orderNumber: string;
  placedAt: string;
  firstName: string;
  items: { name: string; option: string; quantity: number; lineCents: number }[];
  discounts: { label: string; amountCents: number }[];
  totalCents: number;
  paidWith: string | null;
  /** Start order: the day it's ready, e.g. "Saturday, December 20". */
  readyOn: string | null;
  notes: string | null;
  /** The order's page (claim tickets) or invoice (receipts), as a QR code. */
  link: string;
  /** Receipts: the "come back" coupon on the bottom (market stand only). */
  comeback?: { code: string; percent: number; expires: string } | null;
};

const fmtExpiry = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: pickup.timeZone, month: "long", day: "numeric", year: "numeric" }).format(d);

export type StandTheme = { market: Market | null; season: SeasonId; seasonMessage: string; footer: string };

export async function loadStandSlipData(orderId: string): Promise<{ data: StandSlipData; source: string | null }> {
  const [o, r] = await Promise.all([db.order.findUnique({ where: { id: orderId }, include: { items: true } }), loadReceiptData(orderId)]);
  if (!o || !r) throw new Error(`Order ${orderId} not found`);
  const readyOn = o.pickupDate ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(new Date(`${o.pickupDate}T12:00:00Z`)) : null;
  return {
    source: o.source,
    data: {
      orderNumber: o.orderNumber,
      placedAt: new Intl.DateTimeFormat("en-US", { timeZone: pickup.timeZone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(o.createdAt),
      firstName: o.customerName === "Walk-in customer" ? "" : o.customerName.split(/\s+/)[0],
      items: o.items.map((i) => ({ name: i.fileName, option: i.colorName, quantity: i.quantity, lineCents: i.lineCents })),
      discounts: r.discounts,
      totalCents: o.totalCents,
      paidWith: r.card,
      readyOn,
      notes: o.notes,
      link: `${appUrl()}/orders/${o.viewToken}${o.pickupDate ? "" : "/invoice"}`,
    },
  };
}

/** The theme for a slip: the market (by id, else the sale's source) and the season right now. */
export async function standTheme(marketIdOrSource: string | null | undefined, seasonOverride?: string | null): Promise<StandTheme> {
  const s = await getPrintSettings();
  const season = await receiptSeason(s, seasonOverride);
  return { market: findMarket(s, marketIdOrSource), season, seasonMessage: seasonMessage(s, season), footer: s.footer };
}

/** An order's slip as a PNG for the printer. */
export async function renderStandSlipForOrder(orderId: string, slip: StandSlip, marketId?: string | null) {
  const { data, source } = await loadStandSlipData(orderId);
  if (slip === "receipt") {
    const c = await comebackCouponFor(orderId);
    data.comeback = c ? { code: c.code, percent: c.percent, expires: fmtExpiry(c.expiresAt) } : null;
  }
  const theme = await standTheme(marketId || source);
  return { png: await renderStandSlipPng(slip, data, theme), orderNumber: data.orderNumber };
}

/** Made-up order for previews and test prints. */
export function sampleSlipData(slip: StandSlip): StandSlipData {
  return {
    orderNumber: "LL-1042",
    placedAt: new Intl.DateTimeFormat("en-US", { timeZone: pickup.timeZone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date()),
    firstName: "Sam",
    items: [
      { name: "Fun-gi mushroom lamp", option: "Red cap", quantity: 1, lineCents: 4500 },
      { name: "Cloudy night light", option: "", quantity: 2, lineCents: 5000 },
    ],
    discounts: slip === "receipt" ? [{ label: "Market day 10% off", amountCents: 950 }] : [],
    totalCents: 8550,
    paidWith: "Card (in person)",
    readyOn: slip === "claim" ? "Saturday, December 20" : null,
    notes: slip === "claim" ? "Name on the base: AVA" : null,
    link: `${appUrl()}/lightlab`,
    comeback: slip === "receipt" ? { code: "512345678901", percent: 5, expires: fmtExpiry(new Date(Date.now() + 60 * 86_400_000)) } : null,
  };
}

// ── Drawing ──────────────────────────────────────────────────────────────

const fontDir = () => path.resolve(/* turbopackIgnore: true */ process.cwd(), "assets/fonts");
export function standFonts() {
  const dir = fontDir();
  return [
    { name: "Gabarito", data: readFileSync(path.join(dir, "gabarito-latin-400-normal.woff")), weight: 400 as const, style: "normal" as const },
    { name: "Gabarito", data: readFileSync(path.join(dir, "gabarito-latin-800-normal.woff")), weight: 800 as const, style: "normal" as const },
    { name: "Instrument Serif", data: readFileSync(path.join(dir, "instrument-serif-latin-400-italic.woff")), weight: 400 as const, style: "italic" as const },
  ];
}

let logoCache: string | null = null;
export function standLogo() {
  logoCache ??= `data:image/png;base64,${readFileSync(path.resolve(/* turbopackIgnore: true */ process.cwd(), "public/brand/lightlab-logo.png")).toString("base64")}`;
  return logoCache;
}

// eslint-disable-next-line @next/next/no-img-element
const ArtImg = ({ art, mt = 0 }: { art: Art | null; mt?: number }) => (art ? <img src={artUri(art)} width={RECEIPT_WIDTH} height={art.h} alt="" style={{ marginTop: mt }} /> : null);
const Rule = ({ dashed = false }: { dashed?: boolean }) => <div style={{ display: "flex", alignSelf: "stretch", borderTop: `${dashed ? 2 : 3}px ${dashed ? "dashed" : "solid"} black`, margin: "12px 0" }} />;
const serif = { fontFamily: "Instrument Serif", fontStyle: "italic" as const, fontWeight: 400 };

export async function renderStandSlipPng(slip: StandSlip, d: StandSlipData, theme: StandTheme): Promise<Buffer> {
  const top = seasonTop(theme.season);
  // Kept short: the scene near the bottom only for a season with nothing along the top (Remembrance Day's poppy).
  const bottom = top ? null : seasonBottom(theme.season);
  // A night market's string of lights would repeat Christmas's along the top.
  const band = theme.market && !(theme.market.art === "lights" && theme.season === "christmas") ? marketBand(theme.market.art) : null;
  const lamps = lampRow();
  const qr = await QRCode.toString(d.link, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  const barcode = slip === "gift" ? await orderBarcode(d.orderNumber) : null;
  const prices = slip !== "gift";
  const title = slip === "gift" ? "Gift Receipt" : slip === "claim" ? "Order Ticket" : "Receipt";
  const closing = [theme.seasonMessage, theme.market?.message || theme.footer].filter(Boolean);

  const couponBarcode = d.comeback ? await orderBarcode(d.comeback.code) : null;
  const height = (d.comeback ? 470 : 0) + 1500 + d.items.length * 70 + d.discounts.length * 30 + (top?.h ?? 0) + (bottom?.h ?? 0) + (band?.h ?? 0) + (d.notes ? 90 : 0);

  const tree = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "100%", background: "white", color: "black", fontFamily: "Gabarito", fontSize: 24, lineHeight: 1.2 }}>
      <ArtImg art={top} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={standLogo()} width={300} height={118} alt={lightlab.name} style={{ marginTop: top ? 10 : 0 }} />

      {theme.market && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch", marginTop: 10 }}>
          <ArtImg art={band} />
          <span style={{ fontSize: 34, fontWeight: 800, marginTop: band ? 6 : 0, textAlign: "center" }}>{theme.market.name}</span>
          {theme.market.place && <span style={{ ...serif, fontSize: 28 }}>{theme.market.place}</span>}
        </div>
      )}

      <Rule />
      <span style={{ fontSize: 46, fontWeight: 800, letterSpacing: 1 }}>{title}</span>
      {slip === "gift" && <span style={{ ...serif, fontSize: 32, marginTop: 2 }}>Someone picked this out just for you</span>}
      <span style={{ fontSize: 22, marginTop: 4 }}>
        {d.orderNumber} · {d.placedAt}
      </span>

      {slip === "claim" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch", background: "black", color: "white", borderRadius: 28, padding: "14px 12px 18px", marginTop: 14 }}>
          {d.firstName && <span style={{ fontSize: 26 }}>Made for {d.firstName}</span>}
          <span style={{ fontSize: 22, marginTop: 6 }}>READY BY</span>
          <span style={{ fontSize: 40, fontWeight: 800, textAlign: "center" }}>{d.readyOn ?? "We'll be in touch"}</span>
          <span style={{ fontSize: 20, marginTop: 6 }}>We&apos;ll email you when it&apos;s ready</span>
        </div>
      )}

      <Rule dashed />
      <div style={{ display: "flex", flexDirection: "column", alignSelf: "stretch", padding: "0 6px" }}>
        {d.items.map((it, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 800 }}>
              <span style={{ maxWidth: prices ? 420 : 560 }}>
                {it.quantity > 1 ? `${it.quantity} × ` : ""}
                {it.name}
              </span>
              {prices && <span>{money(it.lineCents)}</span>}
            </div>
            {it.option && <span style={{ fontSize: 21 }}>{it.option}</span>}
          </div>
        ))}
        {prices &&
          d.discounts.map((x) => (
            <div key={x.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 22 }}>
              <span>{x.label}</span>
              <span>-{money(x.amountCents)}</span>
            </div>
          ))}
        {prices && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 32, fontWeight: 800, borderTop: "3px solid black", paddingTop: 6 }}>
              <span>TOTAL (CAD)</span>
              <span>{money(d.totalCents)}</span>
            </div>
            {d.paidWith && <span style={{ fontSize: 20 }}>Paid with {d.paidWith}</span>}
          </div>
        )}
        {d.notes && slip === "claim" && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>NOTES</span>
            <span style={{ fontSize: 22 }}>{d.notes}</span>
          </div>
        )}
      </div>

      {slip === "gift" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {barcode && <img src={barcode.src} width={barcode.width} height={barcode.height} alt={d.orderNumber} />}
          <span style={{ fontSize: 20, marginTop: 6, textAlign: "center" }}>Need a different colour? Bring this slip to the stand</span>
          <span style={{ fontSize: 20 }}>or email {legal.contactEmail}</span>
        </div>
      )}

      {closing.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16, padding: "0 10px" }}>
          {closing.map((line, i) => (
            <span key={i} style={{ ...serif, fontSize: i ? 28 : 38, textAlign: "center", marginTop: i ? 4 : 0 }}>
              {line}
            </span>
          ))}
        </div>
      )}

      <ArtImg art={bottom} mt={12} />

      {slip !== "gift" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/svg+xml;base64,${Buffer.from(qr).toString("base64")}`} width={170} height={170} alt="" />
          <span style={{ fontSize: 21, fontWeight: 800, marginTop: 6 }}>{slip === "claim" ? "Scan to check on your order" : "Scan for your receipt online"}</span>
        </div>
      )}

      <Rule />
      <ArtImg art={lamps} />
      <span style={{ fontSize: 20, marginTop: 6 }}>coastlineprints.ca/lightlab</span>
      <span style={{ ...serif, fontSize: 22 }}>handmade in victoria, b.c.</span>

      {d.comeback && (
        // Torn off and kept: a percent off the next visit, at the stand only.
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch", marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", alignSelf: "stretch", gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artUri(scissors)} width={34} height={24} alt="" />
            <div style={{ display: "flex", flex: 1, borderTop: "3px dashed black" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch", padding: "4px 12px 8px", marginTop: 14 }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3 }}>COME BACK SOON</span>
            <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1 }}>{d.comeback.percent}% off</span>
            <span style={{ ...serif, fontSize: 30 }}>your next visit to the LightLab stand</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {couponBarcode && <img src={couponBarcode.src} width={couponBarcode.width} height={couponBarcode.height} alt="" style={{ marginTop: 10 }} />}
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 3, marginTop: 4 }}>{formatCardNumber(d.comeback.code)}</span>
            <span style={{ fontSize: 19, marginTop: 6, textAlign: "center" }}>One use · Valid until {d.comeback.expires}</span>
            <span style={{ fontSize: 19, textAlign: "center" }}>At any LightLab market stand (not online)</span>
          </div>
        </div>
      )}
    </div>
  );

  const res = new ImageResponse(tree, { width: RECEIPT_WIDTH, height: Math.min(4000, height), fonts: standFonts() });
  return Buffer.from(await res.arrayBuffer());
}
