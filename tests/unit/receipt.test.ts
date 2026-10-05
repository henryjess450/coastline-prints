import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { pickup } from "@config/pickup";
import { pngToBitmap } from "@/lib/receipt/bitmap";
import { encodeEscPos, encodeStar, type Bitmap } from "@/lib/receipt/escpos";
import { pickupParts } from "@/lib/pickup";

function png(width: number, height: number, black: (x: number, y: number) => boolean) {
  const img = new PNG({ width, height });
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = black(x, y) ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  return PNG.sync.write(img);
}

describe("receipt bitmap", () => {
  it("packs pixels MSB-first and trims trailing white rows", () => {
    const bmp = pngToBitmap(png(16, 10, (x, y) => y < 2 && (x === 0 || x === 9)));
    expect(bmp.widthBytes).toBe(2);
    expect(bmp.heightDots).toBe(2);
    expect(Array.from(bmp.data)).toEqual([0x80, 0x40, 0x80, 0x40]);
  });
});

describe("Star raster encoding", () => {
  const bmp: Bitmap = { widthBytes: 2, heightDots: 3, data: Uint8Array.from([0xff, 0x00, 0, 0, 0x01, 0x80]) };
  const out = encodeStar(bmp);
  it("starts with init, raster mode and partial-cut setup", () => {
    expect([...out.subarray(0, 17)]).toEqual([0x1b, 0x40, 0x1b, 0x2a, 0x72, 0x52, 0x1b, 0x2a, 0x72, 0x41, 0x1b, 0x2a, 0x72, 0x45, 0x31, 0x33, 0x00]);
  });
  it("trims each row, skips blank rows with ESC *rY, and ends with feed+cut and raster exit", () => {
    const body = [...out.subarray(17)];
    expect(body.slice(0, 4)).toEqual([0x62, 1, 0, 0xff]); // row 1: trailing zero byte trimmed
    expect(body.slice(4, 10)).toEqual([0x1b, 0x2a, 0x72, 0x59, 0x31, 0x00]); // 1 blank row
    expect(body.slice(10, 15)).toEqual([0x62, 2, 0, 0x01, 0x80]);
    expect(body.slice(-13)).toEqual([0x1b, 0x2a, 0x72, 0x59, 0x31, 0x00, 0x1b, 0x0c, 0x04, 0x1b, 0x2a, 0x72, 0x42]);
  });
});

describe("ESC/POS raster encoding", () => {
  it("uses GS v 0 with the right size and cuts", () => {
    const out = encodeEscPos({ widthBytes: 72, heightDots: 300, data: new Uint8Array(72 * 300) });
    expect([...out.subarray(0, 10)]).toEqual([0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00, 72, 0, 0, 1]); // first band 256 rows
    expect([...out.subarray(-7)]).toEqual([0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00]);
  });
});

describe("explicit pickup wording", () => {
  it("includes the year and both clock times", () => {
    expect(pickupParts("2026-10-10", "17:00", pickup)).toEqual({ date: "Saturday, October 10, 2026", time: "5:00 PM to 6:00 PM" });
    expect(pickupParts("2026-10-12", "19:00", pickup)?.time).toBe("7:00 PM to 8:00 PM");
    expect(pickupParts("2026-10-11", "11:00", pickup)?.time).toBe("11:00 AM to 12:00 PM");
  });
});
