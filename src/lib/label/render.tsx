import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { labels, type LabelDesignId } from "@config/labels";
import { site } from "@config/site";
import type { LabelData } from "./data";
import { LABEL_PX, labelTree } from "./designs";
import { placeLabels, spotRect, spotsPerSheet } from "./sheet";

function loadFonts() {
  const dir = path.resolve(/* turbopackIgnore: true */ process.cwd(), "assets/fonts");
  const f = (file: string) => readFileSync(path.join(dir, file));
  const font = (name: string, file: string, weight: 400 | 500 | 600 | 700 | 800) => ({ name, data: f(file), weight, style: "normal" as const });
  return [
    font("Montserrat", "montserrat-latin-400-normal.woff", 400),
    font("Montserrat", "montserrat-latin-600-normal.woff", 600),
    font("Montserrat", "montserrat-latin-700-normal.woff", 700),
    font("Montserrat", "montserrat-latin-800-normal.woff", 800),
    font("DM Mono", "dm-mono-latin-500-normal.woff", 500),
    // Letters outside Montserrat's Latin set (Polish, Vietnamese names...) fall back to Arimo.
    font("Arimo", "Arimo-Regular.ttf", 400),
    font("Arimo", "Arimo-Bold.ttf", 700),
  ];
}
let fontCache: ReturnType<typeof loadFonts> | null = null;
const fonts = () => (fontCache ??= loadFonts());

export const isLabelDesign = (v: unknown): v is LabelDesignId => labels.designs.some((d) => d.id === v);

/** One label as a 300 dpi PNG. */
export async function renderLabelPng(design: LabelDesignId, d: LabelData) {
  const res = new ImageResponse(await labelTree(design, d), { ...LABEL_PX, fonts: fonts() });
  return Buffer.from(await res.arrayBuffer());
}

/**
 * A Letter PDF with one label per package, starting at spot `start` on the
 * Avery sheet and carrying on to a new sheet if it runs out of spots.
 * Print at 100% ("Actual size"), never "Fit to page".
 */
export async function renderLabelPdf(design: LabelDesignId, list: LabelData[], start: number) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${site.name} shipping label ${list[0]?.orderNumber ?? ""}`.trim());
  doc.setCreator(site.name);
  const [W, H] = labels.sheet.pageIn.map((n) => n * 72);
  const pages: ReturnType<typeof doc.addPage>[] = [];
  const spots = placeLabels(list.length, start);
  for (let i = 0; i < list.length; i++) {
    const { page, spot } = spots[i];
    while (pages.length <= page) pages.push(doc.addPage([W, H]));
    const img = await doc.embedPng(await renderLabelPng(design, list[i]));
    const r = spotRect(spot);
    const s = labels.safeIn * 72;
    pages[page].drawImage(img, { x: r.x + s, y: r.y + s, width: r.width - 2 * s, height: r.height - 2 * s });
  }
  return Buffer.from(await doc.save());
}

/**
 * Alignment test for plain paper: an outline of every label spot, numbered,
 * with a cross at each centre. Hold it over a label sheet against a window
 * and adjust `labels.nudgeIn` until the outlines sit on the label edges.
 */
export async function renderAlignmentPdf() {
  const doc = await PDFDocument.create();
  doc.setTitle(`${labels.sheet.name} alignment test`);
  const [W, H] = labels.sheet.pageIn.map((n) => n * 72);
  const p = doc.addPage([W, H]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const navy = rgb(14 / 255, 68 / 255, 113 / 255);
  for (let n = 1; n <= spotsPerSheet(); n++) {
    const r = spotRect(n);
    p.drawRectangle({ x: r.x, y: r.y, width: r.width, height: r.height, borderColor: navy, borderWidth: 0.75 });
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    p.drawLine({ start: { x: cx - 18, y: cy }, end: { x: cx + 18, y: cy }, thickness: 0.75, color: navy });
    p.drawLine({ start: { x: cx, y: cy - 18 }, end: { x: cx, y: cy + 18 }, thickness: 0.75, color: navy });
    p.drawText(String(n), { x: cx - 8, y: cy + 40, size: 28, font: bold, color: navy });
  }
  const note = `Print at 100% (Actual size) on plain paper. Nudge now: x ${labels.nudgeIn.x} in, y ${labels.nudgeIn.y} in (config/labels.ts).`;
  p.drawText(note, { x: 36, y: 14, size: 8, font: reg, color: rgb(0.35, 0.4, 0.45) });
  return Buffer.from(await doc.save());
}
