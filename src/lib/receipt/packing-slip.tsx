import "server-only";
import { ImageResponse } from "next/og";
import { dayParts, hours } from "@/lib/shop/markets";
import type { PackingList } from "@/lib/shop/packing.server";
import { RECEIPT_WIDTH } from "./render";
import { standFonts, standLogo } from "./stand";

/** The packing list for a market day, on the receipt printer: tick boxes to check off while loading the car. */
export async function renderPackingSlipPng(p: PackingList): Promise<Buffer> {
  const box = <div style={{ display: "flex", width: 26, height: 26, border: "3px solid black", borderRadius: 5, marginRight: 12, flexShrink: 0 }} />;
  const row = (key: string, text: string, right?: string, sub?: string) => (
    <div key={key} style={{ display: "flex", alignItems: "flex-start", marginBottom: 10 }}>
      {box}
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 25, fontWeight: 800 }}>
          <span style={{ maxWidth: 400 }}>{text}</span>
          {right && <span>{right}</span>}
        </div>
        {sub && <span style={{ fontSize: 20 }}>{sub}</span>}
      </div>
    </div>
  );
  const heading = (t: string) => <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, marginTop: 18, marginBottom: 10, borderBottom: "3px solid black", paddingBottom: 4, alignSelf: "stretch" }}>{t}</span>;
  const bring = p.lines.filter((l) => l.bring > 0);
  const d = dayParts(p.market.date);
  const height = 700 + p.pickups.reduce((n, o) => n + 50 + o.items.length * 26, 0) + bring.length * 64 + p.kit.length * 40;

  const tree = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "100%", background: "white", color: "black", fontFamily: "Gabarito", padding: "0 8px" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={standLogo()} width={230} height={90} alt="" />
      <span style={{ fontSize: 40, fontWeight: 800, marginTop: 6 }}>Packing list</span>
      <span style={{ fontSize: 28, fontWeight: 800, textAlign: "center" }}>{p.market.name}</span>
      <span style={{ fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 26 }}>
        {d.long}, {hours(p.market)}
      </span>
      <div style={{ display: "flex", flexDirection: "column", alignSelf: "stretch" }}>
        {p.pickups.length > 0 && heading(`ORDERS TO BRING (${p.pickups.length})`)}
        {p.pickups.map((o) => row(o.orderNumber, `${o.orderNumber} · ${o.name}`, o.ready ? "packed" : "", o.items.join(", ")))}
        {heading("LAMPS")}
        {bring.length === 0 && <span style={{ fontSize: 22 }}>Nothing in stock to bring.</span>}
        {bring.map((l) => row(l.key, `${l.bring} × ${l.name}`, "", [l.option, l.stock !== null ? `${l.stock} on hand` : "made to order", l.lastTime !== null ? `${l.lastTime} sold last time` : null].filter(Boolean).join(" · ")))}
        {heading("STAND KIT")}
        {p.kit.map((k, i) => row(`kit${i}`, k))}
      </div>
    </div>
  );
  const res = new ImageResponse(tree, { width: RECEIPT_WIDTH, height: Math.min(4000, height), fonts: standFonts() });
  return Buffer.from(await res.arrayBuffer());
}
