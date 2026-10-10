import "server-only";
import { ImageResponse } from "next/og";
import { pickup } from "@config/pickup";
import { db } from "@/lib/db";
import { loadFonts, orderBarcode, RECEIPT_WIDTH } from "./render";

/**
 * The little stub printed after each scan at the scan station:
 * "ORDER CP-2610-BDFP / Updated to: Printing / To undo, visit the admin dashboard".
 */
export async function renderScanStubPng(orderId: string, statusLabel: string) {
  const o = await db.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, customerName: true } });
  if (!o) throw new Error(`Order ${orderId} not found`);
  const fonts = loadFonts();
  const when = new Intl.DateTimeFormat("en-CA", { timeZone: pickup.timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date());
  const barcode = await orderBarcode(o.orderNumber);
  const res = new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "white", color: "black", fontFamily: fonts.family, padding: "4px 6px", fontSize: 22 }}>
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>ORDER</span>
        <span style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.05 }}>{o.orderNumber}</span>
        <span style={{ fontSize: 20 }}>{o.customerName}</span>
        <div style={{ display: "flex", height: 3, background: "black", margin: "10px 0" }} />
        <span style={{ fontSize: 20 }}>Updated to</span>
        <span style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.1 }}>{statusLabel}</span>
        <span style={{ fontSize: 17, marginTop: 4 }}>{when}</span>
        <div style={{ display: "flex", height: 3, background: "black", margin: "10px 0" }} />
        <span style={{ fontSize: 19 }}>To undo, visit the admin dashboard.</span>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={barcode.src} width={barcode.width} height={barcode.height} alt={o.orderNumber} />
        </div>
      </div>
    ),
    {
      width: RECEIPT_WIDTH,
      height: 420,
      fonts: [
        { name: fonts.family, data: fonts.regular, weight: 400, style: "normal" },
        { name: fonts.family, data: fonts.bold, weight: 700, style: "normal" },
      ],
    },
  );
  return { png: Buffer.from(await res.arrayBuffer()), orderNumber: o.orderNumber };
}
