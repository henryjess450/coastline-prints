import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { pickup } from "@config/pickup";
import { legal, site } from "@config/site";
import { db } from "@/lib/db";
import { hours, money } from "@/lib/format";
import { pickupParts } from "@/lib/pickup";

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
  notes: string | null;
  items: { fileName: string; quantity: number; detail: string; detail2: string; lineCents: number }[];
  baseFeeCents: number;
  minimumAdjCents: number;
  totalCents: number;
  card: string | null;
  paymentId: string;
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
    notes: o.notes,
    items: o.items.map((i) => ({
      fileName: i.fileName,
      quantity: i.quantity,
      detail: `${i.material} · ${i.colorName} · ${i.sizeX.toFixed(0)}×${i.sizeY.toFixed(0)}×${i.sizeZ.toFixed(0)} mm`,
      detail2: `${i.printerName.replace(/^(Bambu Lab|Elegoo) /, "")} · ${i.quality} · ${i.infill} infill · about ${hours(i.hoursEach * i.quantity)}`,
      lineCents: i.lineCents,
    })),
    baseFeeCents: o.baseFeeCents,
    minimumAdjCents: o.minimumAdjCents,
    totalCents: o.totalCents,
    card: o.cardLast4 ? `${(o.cardBrand ?? "Card").replace(/_/g, " ")} ending ${o.cardLast4}` : null,
    paymentId: o.squarePaymentId,
  };
}

/**
 * Fonts: real Arial if arial.ttf / arialbd.ttf are in RECEIPT_FONT_DIR
 * (default ./fonts), otherwise the bundled Arimo (metric-identical to Arial).
 */
function loadFonts() {
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

const Rule = ({ thick = false }: { thick?: boolean }) => <div style={{ display: "flex", height: thick ? 4 : 2, background: "black", margin: "14px 0" }} />;

const Row = ({ left, right, size = 24, bold = false }: { left: string; right: string; size?: number; bold?: boolean }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: size, fontWeight: bold ? 700 : 400, marginTop: 4 }}>
    <span>{left}</span>
    <span>{right}</span>
  </div>
);

const Label = ({ children }: { children: string }) => <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>{children}</div>;

/** Renders the receipt as a black-on-white PNG, 576 dots wide. */
export async function renderReceiptPng(d: ReceiptData, opts: { test?: boolean } = {}): Promise<Buffer> {
  const fonts = loadFonts();
  const noteLines = d.notes ? Math.ceil(d.notes.length / 34) + d.notes.split("\n").length : 0;
  const height = Math.min(4000, 1050 + d.items.length * 120 + noteLines * 30 + (d.minimumAdjCents ? 34 : 0) + (opts.test ? 80 : 0));

  const tree = (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "white", color: "black", fontFamily: fonts.family, padding: "8px 6px", fontSize: 24 }}>
      {opts.test && (
        <div style={{ display: "flex", justifyContent: "center", border: "4px solid black", padding: 8, fontSize: 34, fontWeight: 700, marginBottom: 12 }}>TEST PRINT</div>
      )}
      <div style={{ display: "flex", justifyContent: "center", fontSize: 46, fontWeight: 700 }}>{site.name.toUpperCase()}</div>
      <div style={{ display: "flex", justifyContent: "center", fontSize: 26, marginTop: 2 }}>Official Order Receipt</div>
      <div style={{ display: "flex", justifyContent: "center", fontSize: 20, marginTop: 4 }}>coastlineprints.ca · {legal.contactEmail}</div>
      <Rule thick />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 24, fontWeight: 700 }}>ORDER</span>
        <span style={{ fontSize: 40, fontWeight: 700 }}>{d.orderNumber}</span>
      </div>
      <div style={{ display: "flex", fontSize: 22, marginTop: 4 }}>Placed {d.placedAt}</div>
      <Rule />

      <Label>PICKUP DATE AND TIME</Label>
      {d.pickupDate ? (
        <div style={{ display: "flex", flexDirection: "column", border: "4px solid black", padding: "10px 12px" }}>
          <span style={{ fontSize: 38, fontWeight: 700 }}>{d.pickupDate}</span>
          <span style={{ fontSize: 38, fontWeight: 700, marginTop: 4 }}>{d.pickupTime}</span>
        </div>
      ) : (
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>Not booked: contact customer</div>
      )}
      <Rule />

      <Label>CUSTOMER</Label>
      <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>{d.customerName}</div>
      <div style={{ display: "flex", fontSize: 24, marginTop: 4, wordBreak: "break-all" }}>Email: {d.customerEmail}</div>
      <div style={{ display: "flex", fontSize: 24, marginTop: 4 }}>Phone: {d.customerPhone}</div>
      <Rule />

      <Label>ITEMS</Label>
      {d.items.map((it, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
          <Row left={`${it.fileName.length > 30 ? it.fileName.slice(0, 29) + "…" : it.fileName}  × ${it.quantity}`} right={money(it.lineCents)} bold />
          <div style={{ display: "flex", fontSize: 20, marginTop: 2 }}>{it.detail}</div>
          <div style={{ display: "flex", fontSize: 20 }}>{it.detail2}</div>
        </div>
      ))}
      <Row left="Order fee" right={money(d.baseFeeCents)} />
      {d.minimumAdjCents > 0 && <Row left="Minimum order top-up" right={money(d.minimumAdjCents)} />}
      <Rule />
      <Row left="TOTAL PAID (CAD)" right={money(d.totalCents)} size={32} bold />
      {d.card && <Row left="Paid by" right={d.card} size={22} />}
      <div style={{ display: "flex", fontSize: 18, marginTop: 6, wordBreak: "break-all" }}>Square payment {d.paymentId}</div>

      {d.notes && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Rule />
          <Label>CUSTOMER NOTES</Label>
          <div style={{ display: "flex", fontSize: 24, whiteSpace: "pre-wrap" }}>{d.notes}</div>
        </div>
      )}
      <Rule thick />
      <div style={{ display: "flex", justifyContent: "center", fontSize: 24, fontWeight: 700 }}>Thank you for your order!</div>
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
