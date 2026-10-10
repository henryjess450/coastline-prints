import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { pickup } from "@config/pickup";
import { site } from "@config/site";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import { hours, money, returningLabel } from "@/lib/format";
import type { AppliedCode } from "@/lib/codes/apply";
import { pickupParts } from "@/lib/pickup";
import type { ColorSlot } from "@/lib/model/colors";
import { shippingAddressLines, shippingBoxesOf } from "@/lib/shipping/address";

/** 72 mm of printable width at 203 dpi on the TSP650II series. */
export const RECEIPT_WIDTH = 576;

export type ReceiptData = {
  orderNumber: string;
  placedAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupDate: string | null;
  pickupTime: string | null;
  /** Shipped orders: the address label and which boxes to pack. */
  ship: { lines: string[]; boxes: string[] } | null;
  shippingCents: number;
  notes: string | null;
  items: { fileName: string; quantity: number; detail: string; lineCents: number }[];
  baseFeeCents: number;
  minimumAdjCents: number;
  discounts: { label: string; amountCents: number }[];
  returning: string | null;
  totalCents: number;
  card: string | null;
  paymentId: string;
  /** The order's invoice online; printed as a QR code at the bottom. */
  invoiceUrl?: string;
};

export async function loadReceiptData(orderId: string): Promise<ReceiptData | null> {
  const o = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!o) return null;
  const parts = pickupParts(o.pickupDate, o.pickupTime, pickup);
  return {
    orderNumber: o.orderNumber,
    placedAt: new Intl.DateTimeFormat("en-US", { timeZone: pickup.timeZone, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(o.createdAt),
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    pickupDate: parts?.date ?? null,
    pickupTime: parts?.time ?? null,
    ship: o.fulfillment === "SHIP" ? { lines: shippingAddressLines(o) ?? [], boxes: shippingBoxesOf(o).map((b) => `${b.name} box: ${b.pieces} ${b.pieces === 1 ? "piece" : "pieces"}`) } : null,
    shippingCents: o.shippingCents,
    notes: o.notes,
    items: o.items.map((i) => ({
      fileName: i.fileName,
      quantity: i.quantity,
      detail:
        `${i.material} ${i.colorName} · ${i.sizeX.toFixed(0)}×${i.sizeY.toFixed(0)}×${i.sizeZ.toFixed(0)} mm · ${i.printerName.replace(/^(Bambu Lab|Elegoo) /, "")} · ${hours(i.hoursEach * i.quantity)}` +
        // Multicolour: which stock colour each file colour prints in.
        (i.colorSlots ? ` · Colours: ${(JSON.parse(i.colorSlots) as ColorSlot[]).map((c) => `${c.filament} ${c.colorName}`).join(", ")}` : ""),
      lineCents: i.lineCents,
    })),
    baseFeeCents: o.baseFeeCents,
    minimumAdjCents: o.minimumAdjCents,
    discounts: [
      ...(JSON.parse(o.appliedCodes) as AppliedCode[]).map((a) => ({ label: a.label, amountCents: a.amountCents })),
      ...(o.etransferDiscountCents > 0 ? [{ label: "e-Transfer discount", amountCents: o.etransferDiscountCents }] : []),
    ],
    returning: returningLabel(o.customerOrderCount),
    totalCents: o.totalCents,
    card: o.paymentMethod === "ETRANSFER" ? "Interac e-Transfer" : o.cardLast4 ? `${(o.cardBrand ?? "Card").replace(/_/g, " ")} ending ${o.cardLast4}` : null,
    invoiceUrl: `${appUrl()}/orders/${o.viewToken}/invoice`,
    paymentId: o.squarePaymentId.startsWith("nopay_") ? "none (gift card)" : o.paymentMethod === "ETRANSFER" ? "e-Transfer" : o.squarePaymentId,
  };
}

/**
 * Fonts: real Arial if arial.ttf / arialbd.ttf are in RECEIPT_FONT_DIR
 * (default ./fonts), otherwise the bundled Arimo (metric-identical to Arial).
 */
export function loadFonts() {
  // Runtime-only paths: tell the bundler not to trace the whole project.
  const dir = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.RECEIPT_FONT_DIR ?? "fonts");
  const find = (name: string) => {
    if (!existsSync(dir)) return null;
    const hit = readdirSync(dir).find((f) => f.toLowerCase() === name);
    return hit ? readFileSync(path.join(dir, hit)) : null;
  };
  const regular = find("arial.ttf");
  const bold = find("arialbd.ttf");
  if (regular && bold) return { family: "Arial", regular, bold };
  const bundled = path.resolve(/* turbopackIgnore: true */ process.cwd(), "assets/fonts");
  return { family: "Arimo", regular: readFileSync(path.join(bundled, "Arimo-Regular.ttf")), bold: readFileSync(path.join(bundled, "Arimo-Bold.ttf")) };
}

/** The black wordmark as a data URI (falls back to text if the file is missing). */
let wordmarkCache: string | null = null;
export function wordmark() {
  if (!wordmarkCache) {
    const file = path.resolve(/* turbopackIgnore: true */ process.cwd(), "public/brand/wordmark-black.png");
    wordmarkCache = `data:image/png;base64,${readFileSync(file).toString("base64")}`;
  }
  return wordmarkCache;
}

// Compact layout: every pixel of height is paper.
const Rule = () => <div style={{ display: "flex", height: 2, background: "black", margin: "8px 0" }} />;

const Row = ({ left, right, size = 22, bold = false }: { left: string; right: string; size?: number; bold?: boolean }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: size, fontWeight: bold ? 700 : 400, lineHeight: 1.2 }}>
    <span>{left}</span>
    <span>{right}</span>
  </div>
);

/** Renders the receipt as a black-on-white PNG, 576 dots wide (blank space is trimmed before printing). */
export async function renderReceiptPng(d: ReceiptData, opts: { test?: boolean } = {}): Promise<Buffer> {
  const fonts = loadFonts();
  const noteLines = d.notes ? Math.ceil(d.notes.length / 40) + d.notes.split("\n").length : 0;
  const height = Math.min(4000, 640 + d.discounts.length * 26 + d.items.length * 70 + noteLines * 26 + (d.minimumAdjCents ? 28 : 0) + (d.ship ? 60 + (d.ship.lines.length + d.ship.boxes.length) * 30 : 0) + (opts.test ? 50 : 0) + (d.invoiceUrl ? 250 : 0));
  // A QR code to the order's invoice, so the customer can scan it for a copy.
  const qr = d.invoiceUrl ? await QRCode.toString(d.invoiceUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }) : null;

  const tree = (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "white", color: "black", fontFamily: fonts.family, padding: "0 4px", fontSize: 22, lineHeight: 1.2 }}>
      {opts.test && <div style={{ display: "flex", justifyContent: "center", border: "3px solid black", fontSize: 26, fontWeight: 700, marginBottom: 6 }}>TEST PRINT</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wordmark()} width={150} height={88} alt={site.name} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ fontSize: 18 }}>Official Receipt</span>
          <span style={{ fontSize: 34, fontWeight: 700 }}>{d.orderNumber}</span>
          <span style={{ fontSize: 17 }}>Placed {d.placedAt}</span>
        </div>
      </div>
      <Rule />

      {d.ship ? (
        <div style={{ display: "flex", flexDirection: "column", border: "3px solid black", padding: "4px 10px" }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>SHIP · CANADA POST</span>
          {d.ship.lines.map((l, i) => (
            <span key={i} style={{ fontSize: i ? 22 : 26, fontWeight: 700 }}>
              {l}
            </span>
          ))}
          {d.ship.boxes.map((b, i) => (
            <span key={`b${i}`} style={{ fontSize: 20, marginTop: i ? 0 : 6 }}>
              {b}
            </span>
          ))}
        </div>
      ) : d.pickupDate ? (
        <div style={{ display: "flex", flexDirection: "column", border: "3px solid black", padding: "4px 10px" }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>PICKUP</span>
          <span style={{ fontSize: 30, fontWeight: 700 }}>{d.pickupDate}</span>
          <span style={{ fontSize: 30, fontWeight: 700 }}>{d.pickupTime}</span>
        </div>
      ) : (
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700 }}>PICKUP NOT BOOKED: contact customer</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 700 }}>{d.customerName}</span>
        {d.returning && <span style={{ fontSize: 20, fontWeight: 700 }}>★ {d.returning}</span>}
        <span style={{ fontSize: 22, wordBreak: "break-all" }}>{d.customerEmail}</span>
        <span style={{ fontSize: 22 }}>{d.customerPhone}</span>
      </div>
      <Rule />

      {d.items.map((it, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", marginBottom: 4 }}>
          <Row left={`${it.quantity} × ${it.fileName.length > 30 ? it.fileName.slice(0, 29) + "…" : it.fileName}`} right={money(it.lineCents)} bold />
          <span style={{ fontSize: 17 }}>{it.detail}</span>
        </div>
      ))}
      <Row left="Order fee" right={money(d.baseFeeCents)} size={20} />
      {d.minimumAdjCents > 0 && <Row left="Minimum order top-up" right={money(d.minimumAdjCents)} size={20} />}
      {d.ship && <Row left="Shipping" right={money(d.shippingCents)} size={20} />}
      {d.discounts.map((x) => (
        <Row key={x.label} left={x.label} right={`-${money(x.amountCents)}`} size={20} />
      ))}
      <Row left="TOTAL PAID (CAD)" right={money(d.totalCents)} size={28} bold />
      <span style={{ fontSize: 15 }}>
        {d.card ? `${d.card} · ` : ""}Square {d.paymentId}
      </span>

      {d.notes && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Rule />
          <span style={{ fontSize: 16, fontWeight: 700 }}>NOTES</span>
          <span style={{ fontSize: 20, whiteSpace: "pre-wrap" }}>{d.notes}</span>
        </div>
      )}

      {qr && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 14 }}>
          <Rule />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/svg+xml;base64,${Buffer.from(qr).toString("base64")}`} width={180} height={180} alt="Invoice" style={{ marginTop: 8 }} />
          <span style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>Scan for your invoice</span>
          <span style={{ fontSize: 15 }}>and to check on your order</span>
        </div>
      )}
    </div>
  );

  const res = new ImageResponse(tree, {
    width: RECEIPT_WIDTH,
    height,
    fonts: [
      { name: fonts.family, data: fonts.regular, weight: 400, style: "normal" },
      { name: fonts.family, data: fonts.bold, weight: 700, style: "normal" },
    ],
  });
  return Buffer.from(await res.arrayBuffer());
}
