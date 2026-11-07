import { writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { cardBatchPdf } from "@/lib/codes/thank-you-pdf";
import { cardLink } from "@/lib/codes/thank-you";

const batch = { id: "abcd1234", heading: "Thanks for shopping with us!", message: "Here's a little something for next time.", percent: 5, expiresAt: "2027-05-08T12:00:00.000Z", createdAt: "2026-11-07T12:00:00.000Z" };

describe("thank-you cards", () => {
  it("prints twelve cards a page", async () => {
    const codes = Array.from({ length: 13 }, (_, i) => String(100000000000 + i));
    const bytes = await cardBatchPdf(batch, codes);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
    if (process.env.CARDS_PDF_OUT) writeFileSync(process.env.CARDS_PDF_OUT, bytes);
  });

  it("links the QR to the LightLab shop with the code", () => {
    expect(cardLink("123456789012")).toMatch(/\/lightlab\?code=123456789012$/);
  });
});
