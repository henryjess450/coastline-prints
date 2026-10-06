import { PNG } from "pngjs";
import type { Bitmap } from "./escpos";

/**
 * Turns a rendered PNG into a 1-bit printer bitmap. Pixels darker than the
 * threshold print black. Blank rows at the top and bottom are trimmed, so
 * no paper is fed for empty space.
 */
/** 4x4 ordered-dither matrix: turns greys into an even dot pattern. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => ((v + 0.5) / 16) * 255);

export function pngToBitmap(png: Buffer, threshold = 150, opts: { dither?: boolean } = {}): Bitmap {
  const img = PNG.sync.read(png);
  const widthBytes = Math.ceil(img.width / 8);
  let height = img.height;
  const data = new Uint8Array(widthBytes * height);
  let firstInk = -1;
  let lastInk = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      // Composite on white so transparent areas stay blank.
      const a = img.data[i + 3] / 255;
      const lum = (0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]) * a + 255 * (1 - a);
      // With dither, the heading grey (#5a5a5a, lum ~90) becomes a dot pattern; everything else stays crisp.
      const cut = opts.dither && lum > 70 && lum < 115 ? BAYER[(y & 3) * 4 + (x & 3)] : threshold;
      if (lum < cut) {
        data[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
        if (firstInk < 0) firstInk = y;
        lastInk = y;
      }
    }
  }
  if (lastInk < 0) return { widthBytes, heightDots: 1, data: data.subarray(0, widthBytes) };
  height = lastInk - firstInk + 1;
  return { widthBytes, heightDots: height, data: data.subarray(firstInk * widthBytes, (lastInk + 1) * widthBytes) };
}
