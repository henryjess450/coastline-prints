import { PNG } from "pngjs";
import type { Bitmap } from "./escpos";

/**
 * Turns a rendered PNG into a 1-bit printer bitmap. Pixels darker than the
 * threshold print black. Trailing white space at the bottom is trimmed.
 */
export function pngToBitmap(png: Buffer, threshold = 150): Bitmap {
  const img = PNG.sync.read(png);
  const widthBytes = Math.ceil(img.width / 8);
  let height = img.height;
  const data = new Uint8Array(widthBytes * height);
  let lastInk = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      // Composite on white so transparent areas stay blank.
      const a = img.data[i + 3] / 255;
      const lum = (0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]) * a + 255 * (1 - a);
      if (lum < threshold) {
        data[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
        lastInk = y;
      }
    }
  }
  height = Math.max(1, lastInk + 1);
  return { widthBytes, heightDots: height, data: data.subarray(0, widthBytes * height) };
}
