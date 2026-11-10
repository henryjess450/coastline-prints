import "server-only";
import { ImageResponse } from "next/og";
import { PDFDocument, rgb } from "pdf-lib";
import { standFonts, standLogo } from "./stand";

/*
 * A LightLab gift note: the customer's message on a 5 x 7 inch card, in the
 * shop's look (black and white, the blue Instrument Serif accent, a little
 * pendant lamp up top, the logo at the foot). Printed from a letter-size PDF
 * at 100% with corner marks to cut along, then tucked in with the lamp.
 */

const DPI = 300;
export const NOTE_CARD = { widthIn: 5, heightIn: 7 };
const BLUE = "#297f9d";

/** Only characters the bundled fonts can draw (no emoji); keeps line breaks, at most 8 lines. */
export function cleanNote(text: string) {
  return text
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e -ſ\n–—…]/g, "")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .split("\n")
    .slice(0, 8)
    .join("\n");
}

/** Shorter notes get bigger letters. Sizes are in layout units (1% of the card's width). */
function noteSize(text: string) {
  const n = text.length + text.split("\n").length * 18;
  if (n < 70) return 7.6;
  if (n < 140) return 6.4;
  if (n < 220) return 5.4;
  return 4.6;
}

export async function renderGiftNotePng(note: string): Promise<Buffer> {
  const W = NOTE_CARD.widthIn * DPI;
  const H = NOTE_CARD.heightIn * DPI;
  const u = W / 100;
  const text = cleanNote(note);
  const lamp = (
    <svg width={14 * u} height={20 * u} viewBox="0 0 70 100">
      <line x1="35" y1="0" x2="35" y2="40" stroke="#111" strokeWidth="1.6" />
      <path d="M12 66 Q35 30 58 66 Z" fill="#111" />
      <circle cx="35" cy="70" r="6" fill="white" stroke="#111" strokeWidth="2" />
      <line x1="35" y1="82" x2="35" y2="90" stroke={BLUE} strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="78" x2="15" y2="84" stroke={BLUE} strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="78" x2="55" y2="84" stroke={BLUE} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  const tree = (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "white", padding: 5 * u }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "100%", border: `${0.35 * u}px solid #111`, borderRadius: 3 * u, padding: `${4 * u}px ${9 * u}px ${7 * u}px`, fontFamily: "Gabarito" }}>
        {lamp}
        <div style={{ display: "flex", justifyContent: "center", width: "100%", textAlign: "center", fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 6.6 * u, color: BLUE, marginTop: 1 * u }}>a little something for you</div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: noteSize(text) * u, lineHeight: 1.35, color: "#111", textAlign: "center" }}>
            {text.split("\n").map((line, i) => (
              <div key={i} style={{ display: "flex", minHeight: noteSize(text) * u * 0.7 }}>
                {line}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", width: 18 * u, borderTop: `${0.3 * u}px solid #111`, marginBottom: 4 * u }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={standLogo()} alt="" height={10 * u} style={{ objectFit: "contain" }} />
      </div>
    </div>
  );
  const res = new ImageResponse(tree, { width: W, height: H, fonts: standFonts() });
  return Buffer.from(await res.arrayBuffer());
}

/** Letter page, the card centred at real size, with corner marks just outside it to cut along. */
export async function giftNotePdf(note: string, title = "Gift note") {
  const page = { w: 612, h: 792 };
  const cw = NOTE_CARD.widthIn * 72;
  const ch = NOTE_CARD.heightIn * 72;
  const x = (page.w - cw) / 2;
  const y = (page.h - ch) / 2;
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  const p = pdf.addPage([page.w, page.h]);
  p.drawImage(await pdf.embedPng(await renderGiftNotePng(note)), { x, y, width: cw, height: ch });
  const mark = rgb(0.6, 0.6, 0.6);
  const gap = 6;
  const len = 18;
  for (const [cx, cy] of [
    [x, y],
    [x + cw, y],
    [x, y + ch],
    [x + cw, y + ch],
  ] as const) {
    const sx = cx === x ? -1 : 1;
    const sy = cy === y ? -1 : 1;
    p.drawLine({ start: { x: cx + sx * gap, y: cy }, end: { x: cx + sx * (gap + len), y: cy }, thickness: 0.5, color: mark });
    p.drawLine({ start: { x: cx, y: cy + sy * gap }, end: { x: cx, y: cy + sy * (gap + len) }, thickness: 0.5, color: mark });
  }
  return pdf.save();
}
