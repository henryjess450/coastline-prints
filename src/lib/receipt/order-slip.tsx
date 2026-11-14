import "server-only";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { lightlab } from "@config/lightlab";
import { money } from "@/lib/format";
import { RECEIPT_WIDTH } from "./render";
import { standFonts, standLogo, type StandSlipData } from "./stand";

/**
 * The little slip a customer keeps when an order is taken at a market:
 * their order number, the day it's ready, their details, what's being made
 * and a QR code to check on it. Kept short: no market or season art.
 */
const col = { display: "flex", flexDirection: "column" as const };
const caps = { fontSize: 19, fontWeight: 800, letterSpacing: 3 };
const Dash = () => <div style={{ display: "flex", alignSelf: "stretch", borderTop: "2px dashed black", margin: "12px 0" }} />;

export async function renderOrderSlipPng(d: StandSlipData): Promise<Buffer> {
  const qr = await QRCode.toString(d.link, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  const c = d.customer ?? { name: d.firstName, phone: "", email: "" };
  const contact = [c.phone, c.email].filter(Boolean);

  const tree = (
    <div style={{ ...col, alignItems: "center", width: "100%", height: "100%", background: "white", color: "black", fontFamily: "Gabarito", fontSize: 24, lineHeight: 1.2, padding: "0 10px" }}>
      <div style={{ ...col, alignSelf: "stretch" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={standLogo()} width={190} height={75} alt={lightlab.name} />
          <div style={{ ...col, alignItems: "flex-end" }}>
            <span style={caps}>YOUR ORDER</span>
            <span style={{ fontSize: 54, fontWeight: 800, lineHeight: 1 }}>{d.orderNumber}</span>
          </div>
        </div>
        <div style={{ ...col, alignItems: "center", background: "black", color: "white", borderRadius: 22, padding: "10px 12px 14px", marginTop: 12 }}>
          <span style={{ ...caps, fontSize: 18 }}>READY BY</span>
          <span style={{ fontSize: 38, fontWeight: 800, textAlign: "center" }}>{d.readyOn ?? "We'll be in touch"}</span>
        </div>
        {(c.name || contact.length > 0) && (
          <div style={{ ...col, marginTop: 12 }}>
            {c.name && <span style={{ fontSize: 32, fontWeight: 800 }}>{c.name}</span>}
            {contact.map((x) => (
              <span key={x} style={{ fontSize: 22 }}>
                {x}
              </span>
            ))}
          </div>
        )}
        <Dash />
        {d.items.map((it, i) => (
          <div key={i} style={{ ...col, marginBottom: 4 }}>
            <span style={{ fontSize: 25, fontWeight: 800 }}>
              {it.quantity > 1 ? `${it.quantity} × ` : ""}
              {it.name}
            </span>
            {it.option && <span style={{ fontSize: 20 }}>{it.option}</span>}
          </div>
        ))}
        {d.notes && <span style={{ fontSize: 21, marginTop: 2 }}>Note: {d.notes}</span>}
        <span style={{ fontSize: 22, marginTop: 6 }}>
          Paid {money(d.totalCents)}
          {d.paidWith ? ` · ${d.paidWith}` : ""}
        </span>
        <Dash />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/svg+xml;base64,${Buffer.from(qr).toString("base64")}`} width={140} height={140} alt="" />
          <div style={{ ...col, flex: 1 }}>
            <span style={{ fontSize: 24, fontWeight: 800 }}>Scan to check on your order</span>
            <span style={{ fontSize: 20, marginTop: 4 }}>We&apos;ll email you when it&apos;s ready.</span>
            <span style={{ fontSize: 20 }}>Placed {d.placedAt}</span>
          </div>
        </div>
      </div>
      <span style={{ fontSize: 19, marginTop: 12 }}>coastlineprints.ca/lightlab</span>
    </div>
  );
  // Blank rows below the last line are trimmed before printing.
  const height = 1000 + d.items.length * 90 + (d.notes ? 120 : 0);
  const res = new ImageResponse(tree, { width: RECEIPT_WIDTH, height: Math.min(4000, height), fonts: standFonts() });
  return Buffer.from(await res.arrayBuffer());
}
