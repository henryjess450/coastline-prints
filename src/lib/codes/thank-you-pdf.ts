import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { pdfSafe } from "@/lib/invoice/pdf";
import { cardLink, type CardBatch } from "./thank-you";

const BLUE = rgb(41 / 255, 127 / 255, 157 / 255);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.4, 0.4, 0.4);
const CUT = rgb(0.75, 0.75, 0.75);

/** US Letter, half-inch margins, 3 across and 4 down: twelve 2.5" square cards a page. */
const PAGE = { w: 612, h: 792 };
const COLS = 3;
const ROWS = 4;
const CARD = { w: 180, h: 180 };
const ORIGIN = { x: (PAGE.w - COLS * CARD.w) / 2, y: (PAGE.h - ROWS * CARD.h) / 2 };

/** Splits text into lines that fit a width. */
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function centered(page: PDFPage, text: string, font: PDFFont, size: number, cx: number, y: number, color = INK) {
  page.drawText(text, { x: cx - font.widthOfTextAtSize(text, size) / 2, y, size, font, color });
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Vancouver" });
/** 1234 5678 9012: easier to read out and type. */
const spaced = (code: string) => code.replace(/(\d{4})(?=\d)/g, "$1 ");

/** The batch as a print-ready PDF: twelve cards a page, with dashed cut lines between them. */
export async function cardBatchPdf(batch: CardBatch, codes: string[]) {
  const doc = await PDFDocument.create();
  doc.setTitle(`LightLab thank-you cards (${batch.id})`);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.CourierBold);
  const logo = await doc.embedPng(readFileSync(path.resolve(/* turbopackIgnore: true */ process.cwd(), "public/brand/lightlab-logo.png")));
  const qrs = await Promise.all(codes.map((c) => QRCode.toBuffer(cardLink(c), { type: "png", margin: 0, width: 300, errorCorrectionLevel: "M" })));
  const qrImages = await Promise.all(qrs.map((b) => doc.embedPng(b)));

  for (let start = 0; start < codes.length; start += COLS * ROWS) {
    const page = doc.addPage([PAGE.w, PAGE.h]);
    const onPage = codes.slice(start, start + COLS * ROWS);
    onPage.forEach((code, k) => {
      const col = k % COLS;
      const row = Math.floor(k / COLS);
      const x = ORIGIN.x + col * CARD.w;
      const top = PAGE.h - ORIGIN.y - row * CARD.h;
      const cx = x + CARD.w / 2;
      const pad = 12;

      // Logo
      const lh = 20;
      const lw = (logo.width / logo.height) * lh;
      page.drawImage(logo, { x: cx - lw / 2, y: top - pad - lh, width: lw, height: lh });

      // Heading (up to two lines) and the offer
      let y = top - pad - lh - 16;
      for (const line of wrap(batch.heading, bold, 10.5, CARD.w - 2 * pad).slice(0, 2)) {
        centered(page, line, bold, 10.5, cx, y);
        y -= 13;
      }
      centered(page, `${batch.percent}% off`, bold, 22, cx, y - 16, BLUE);
      y -= 30;
      for (const line of wrap(batch.message, regular, 7, CARD.w - 2 * pad).slice(0, 2)) {
        centered(page, line, regular, 7, cx, y, MUTED);
        y -= 9;
      }

      // QR on the left, how to use it on the right
      const qs = 52;
      const qx = x + pad;
      const qy = top - CARD.h + pad;
      page.drawImage(qrImages[start + k], { x: qx, y: qy, width: qs, height: qs });
      const tx = qx + qs + 8;
      const lines: [string, PDFFont, number, typeof INK][] = [
        ["Scan to shop online,", regular, 6.5, INK],
        ["or show this card at", regular, 6.5, INK],
        ["our market stand.", regular, 6.5, INK],
      ];
      let ty = qy + qs - 6;
      for (const [t, f, s, c] of lines) {
        page.drawText(t, { x: tx, y: ty, size: s, font: f, color: c });
        ty -= 8.5;
      }
      page.drawText(spaced(code), { x: tx, y: ty - 4, size: 7.5, font: mono, color: INK });
      page.drawText(batch.expiresAt ? `One use. Expires ${fmtDate(batch.expiresAt)}.` : "One use.", { x: tx, y: qy, size: 5.5, font: regular, color: MUTED });
    });

    // Dashed cut lines round every card
    const dash = { thickness: 0.5, color: CUT, dashArray: [3, 3] };
    for (let c = 0; c <= COLS; c++) page.drawLine({ start: { x: ORIGIN.x + c * CARD.w, y: ORIGIN.y }, end: { x: ORIGIN.x + c * CARD.w, y: PAGE.h - ORIGIN.y }, ...dash });
    for (let r = 0; r <= ROWS; r++) page.drawLine({ start: { x: ORIGIN.x, y: ORIGIN.y + r * CARD.h }, end: { x: PAGE.w - ORIGIN.x, y: ORIGIN.y + r * CARD.h }, ...dash });
  }
  return doc.save();
}
