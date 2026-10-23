import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { loadLabels, sampleLabel } from "@/lib/label/data";
import { renderLabelPdf, renderLabelPng } from "@/lib/label/render";
import { placeLabels, spotRect } from "@/lib/label/sheet";
import { labels } from "@config/labels";
import { createPaidOrder } from "../helpers/fixtures";

describe("Avery 8168 sheet", () => {
  it("puts the four spots where the labels are (0.5 in margins, 3.5 x 5 in)", () => {
    expect(spotRect(1, labels.sheet, { x: 0, y: 0 })).toEqual({ x: 36, y: 396, width: 252, height: 360 });
    expect(spotRect(2, labels.sheet, { x: 0, y: 0 })).toEqual({ x: 324, y: 396, width: 252, height: 360 });
    expect(spotRect(3, labels.sheet, { x: 0, y: 0 })).toEqual({ x: 36, y: 36, width: 252, height: 360 });
    expect(spotRect(4, labels.sheet, { x: 0, y: 0 })).toEqual({ x: 324, y: 36, width: 252, height: 360 });
  });

  it("fills spots from the starting one and carries on to a new sheet", () => {
    expect(placeLabels(1, 3)).toEqual([{ page: 0, spot: 3 }]);
    expect(placeLabels(3, 3)).toEqual([{ page: 0, spot: 3 }, { page: 0, spot: 4 }, { page: 1, spot: 1 }]);
  });
});

describe("shipping label", () => {
  it("has the customer's address, phone and email, one label per package", async () => {
    const order = await createPaidOrder({ ship: true });
    const list = (await loadLabels(order.id))!;
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]).toMatchObject({ orderNumber: order.orderNumber, phone: "604 555 0123", email: "sam@example.com", to: { name: "Sam Rivers", street: ["1 Main Street"], city: "Halifax NS", postal: "B3H 1A1" } });
    expect(list[0].from[0]).toBe("Coastline Prints");
  });

  it("is null for pickup orders", async () => {
    const order = await createPaidOrder();
    expect(await loadLabels(order.id)).toBeNull();
  });

  it("renders every design at 300 dpi and lays them on a Letter page", async () => {
    for (const d of labels.designs) {
      const png = await renderLabelPng(d.id, sampleLabel());
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1050, 1500]);
    }
    const pdf = await PDFDocument.load(await renderLabelPdf("harbour", [sampleLabel(), sampleLabel()], 4));
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  }, 60_000);
});
