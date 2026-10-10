import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { money } from "@/lib/format";
import type { InvoiceData } from "./data";

const NAVY = rgb(14 / 255, 68 / 255, 113 / 255);
const INK = rgb(0.1, 0.12, 0.15);
const MUTED = rgb(0.42, 0.46, 0.52);
const LINE = rgb(0.85, 0.88, 0.91);
const PAID = rgb(0.07, 0.5, 0.31);

/** The built-in PDF fonts only cover Western European letters; anything else becomes "?". */
export function pdfSafe(s: string) {
  return s
    .replace(/[−–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E -ÿ×·•€]/g, "?");
}

/** Shortens text to fit a width, with "...". */
function fit(text: string, font: PDFFont, size: number, width: number) {
  let t = pdfSafe(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > width) t = t.slice(0, -1);
  return `${t}...`;
}

/**
 * The invoice as a one-page (or more, for big orders) Letter PDF: business
 * and order details, a line for each print, fees and discounts, the total
 * marked PAID, and a QR code that opens the order online.
 */
export async function renderInvoicePdf(d: InvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${d.business.name} invoice ${d.orderNumber}`);
  doc.setAuthor(d.business.name);
  doc.setCreator(d.business.name);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const qr = await doc.embedPng(await QRCode.toBuffer(d.url, { type: "png", margin: 1, width: 300, errorCorrectionLevel: "M" }));

  const W = 612;
  const H = 792;
  const M = 54;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const text = (s: string, x: number, at: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const size = o.size ?? 10;
    const font = o.font ?? regular;
    const t = pdfSafe(s);
    page.drawText(t, { x: o.right ? x - font.widthOfTextAtSize(t, size) : x, y: at, size, font, color: o.color ?? INK });
  };
  const rule = (at: number, thick = 0.75) => page.drawLine({ start: { x: M, y: at }, end: { x: W - M, y: at }, thickness: thick, color: LINE });
  const room = (need: number) => {
    if (y - need > M + 20) return;
    page = doc.addPage([W, H]);
    y = H - M;
  };

  // Header: business on the left, invoice number and date on the right.
  text(d.business.name, M, y - 18, { size: 22, font: bold, color: NAVY });
  text(d.business.email, M, y - 36, { color: MUTED });
  text("INVOICE", W - M, y - 10, { size: 9, font: bold, color: MUTED, right: true });
  text(d.orderNumber, W - M, y - 28, { size: 16, font: bold, right: true });
  text(d.date, W - M, y - 44, { color: MUTED, right: true });
  y -= 64;
  rule(y);

  // Billed to, and pickup or shipping.
  y -= 22;
  text("BILLED TO", M, y, { size: 8, font: bold, color: MUTED });
  text(d.delivery.kind === "ship" ? "SHIPPED TO" : "PICKUP", W / 2, y, { size: 8, font: bold, color: MUTED });
  const left = [d.customer.name, d.customer.email];
  const right = d.delivery.kind === "ship" ? d.delivery.lines : [d.delivery.when];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    y -= 15;
    if (left[i]) text(fit(left[i], regular, 10.5, W / 2 - M - 12), M, y, { size: 10.5, font: i ? regular : bold });
    if (right[i]) text(fit(right[i], regular, 10.5, W / 2 - M), W / 2, y, { size: 10.5 });
  }
  y -= 22;

  // Items.
  const qtyX = W - M - 110;
  rule(y + 8);
  text("ITEM", M, y - 6, { size: 8, font: bold, color: MUTED });
  text("QTY", qtyX, y - 6, { size: 8, font: bold, color: MUTED, right: true });
  text("AMOUNT", W - M, y - 6, { size: 8, font: bold, color: MUTED, right: true });
  y -= 14;
  rule(y);
  for (const it of d.items) {
    room(40);
    y -= 17;
    text(fit(it.name, bold, 10.5, qtyX - M - 30), M, y, { size: 10.5, font: bold });
    text(String(it.quantity), qtyX, y, { size: 10.5, right: true });
    text(money(it.cents), W - M, y, { size: 10.5, right: true });
    y -= 13;
    text(fit(it.detail, regular, 9, qtyX - M - 30), M, y, { size: 9, color: MUTED });
    y -= 9;
    rule(y);
  }

  // Fees, discounts, shipping, gift cards.
  for (const e of d.extras) {
    room(24);
    y -= 18;
    text(fit(e.label, regular, 10, qtyX - M), M, y);
    text(e.minus ? `-${money(e.cents)}` : money(e.cents), W - M, y, { right: true, color: e.minus ? PAID : INK });
  }

  // Total, marked paid.
  room(90);
  y -= 14;
  page.drawLine({ start: { x: W / 2, y }, end: { x: W - M, y }, thickness: 1.5, color: INK });
  y -= 22;
  text("Total paid", W / 2, y, { size: 13, font: bold });
  text(money(d.totalCents), W - M, y, { size: 13, font: bold, right: true });
  y -= 16;
  text(`Paid by ${d.paidBy}`, W - M, y, { size: 9.5, color: MUTED, right: true });
  // A "PAID" stamp.
  page.drawRectangle({ x: M, y: y - 4, width: 62, height: 26, borderColor: PAID, borderWidth: 2, opacity: 0, borderOpacity: 1 });
  text("PAID", M + 13, y + 4, { size: 14, font: bold, color: PAID });

  // QR code to the order online, bottom left; thanks, bottom centre.
  const q = 86;
  page.drawImage(qr, { x: M, y: M + 6, width: q, height: q });
  text("Scan to see your order,", M + q + 12, M + 58, { size: 9.5 });
  text("its status and this invoice online.", M + q + 12, M + 45, { size: 9.5 });
  text(`Thanks for printing with ${d.business.name}. Prices in Canadian dollars.`, W - M, M + 10, { size: 8.5, color: MUTED, right: true });

  return Buffer.from(await doc.save());
}
