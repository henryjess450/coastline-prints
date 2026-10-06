/**
 * Printer command encoders for a 1-bit bitmap (1 = black, MSB first).
 * Star mode is the TSP654II's default ("Star Line Mode"); ESC/POS is for
 * printers switched to ESC/POS emulation.
 */
export type Bitmap = { widthBytes: number; heightDots: number; data: Uint8Array };

/** Blank paper after the last line before the cut: 16 dots = 2 mm at 203 dpi. */
export const BOTTOM_MARGIN_DOTS = 16;

/**
 * Star raster (Star Graphic mode): init, enter raster, continuous paper (no
 * page length, so nothing feeds to a page boundary), partial cut at end of
 * document, one 'b' <len> line per row (blank runs skipped with ESC *rY),
 * then EOT, which feeds just far enough to reach the cutter and cuts.
 * No form feed: on a page-length setting that feeds a lot of blank paper.
 */
export function encodeStar(bmp: Bitmap): Buffer {
  const out: number[] = [];
  out.push(0x1b, 0x40); // ESC @
  out.push(0x1b, 0x2a, 0x72, 0x52, 0x1b, 0x2a, 0x72, 0x41); // ESC *rR ESC *rA
  out.push(0x1b, 0x2a, 0x72, 0x50, 0x30, 0x00); // ESC *rP0: continuous paper, no page length
  out.push(0x1b, 0x2a, 0x72, 0x45, 0x31, 0x33, 0x00); // ESC *rE13: at end of document, feed to the cutter and partial cut
  let blank = 0;
  for (let row = 0; row < bmp.heightDots; row++) {
    const start = row * bmp.widthBytes;
    let last = -1;
    for (let b = bmp.widthBytes - 1; b >= 0; b--) {
      if (bmp.data[start + b]) {
        last = b;
        break;
      }
    }
    if (last < 0) {
      blank++;
      continue;
    }
    if (blank) {
      out.push(0x1b, 0x2a, 0x72, 0x59, ...Buffer.from(String(blank)), 0x00); // ESC *rY<n>
      blank = 0;
    }
    const len = last + 1;
    out.push(0x62, len & 0xff, len >> 8); // 'b' nL nH
    for (let b = 0; b < len; b++) out.push(bmp.data[start + b]);
  }
  out.push(0x1b, 0x2a, 0x72, 0x59, ...Buffer.from(String(BOTTOM_MARGIN_DOTS)), 0x00); // ESC *rY: 2 mm of space after the last line
  out.push(0x04, 0x1b, 0x2a, 0x72, 0x42); // EOT (feed to the cutter and cut), ESC *rB
  return Buffer.from(out);
}

/** ESC/POS raster: GS v 0 in bands of 256 rows, then feed only to the cutter and partial cut. */
export function encodeEscPos(bmp: Bitmap): Buffer {
  const parts: Buffer[] = [Buffer.from([0x1b, 0x40])];
  for (let y = 0; y < bmp.heightDots; y += 256) {
    const rows = Math.min(256, bmp.heightDots - y);
    parts.push(Buffer.from([0x1d, 0x76, 0x30, 0x00, bmp.widthBytes & 0xff, bmp.widthBytes >> 8, rows & 0xff, rows >> 8]));
    parts.push(Buffer.from(bmp.data.subarray(y * bmp.widthBytes, (y + rows) * bmp.widthBytes)));
  }
  parts.push(Buffer.from([0x1b, 0x4a, BOTTOM_MARGIN_DOTS])); // ESC J: 2 mm of space after the last line
  parts.push(Buffer.from([0x1d, 0x56, 0x42, 0x00])); // GS V 66 0: feed to the cutter, partial cut
  return Buffer.concat(parts);
}
