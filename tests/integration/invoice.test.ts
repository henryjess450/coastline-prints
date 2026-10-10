/** Invoices: the same numbers on the page, the PDF and the email; never the pickup address. */
import { describe, expect, it } from "vitest";
import { privateSite } from "@config/private.server";
import { createPaidOrder } from "../helpers/fixtures";

const { loadInvoice, invoiceFileName } = await import("@/lib/invoice/data");
const { renderInvoicePdf, pdfSafe } = await import("@/lib/invoice/pdf");
const { buildEmail } = await import("@/lib/email/build");
const { loadOrderEmailData } = await import("@/lib/email/data");
const { GET } = await import("@/app/orders/[token]/invoice/pdf/route");

describe("invoices", () => {
  it("adds up to the total paid", async () => {
    const order = await createPaidOrder({ ship: true });
    const inv = (await loadInvoice({ id: order.id }))!;
    const sum = inv.items.reduce((n, i) => n + i.cents, 0) + inv.extras.reduce((n, e) => n + (e.minus ? -e.cents : e.cents), 0);
    expect(sum).toBe(inv.totalCents);
    expect(inv.delivery.kind).toBe("ship");
    expect(inv.url).toContain(`/orders/${order.viewToken}`);
  });

  it("makes a PDF, downloadable by the order's private link", async () => {
    const order = await createPaidOrder();
    const pdf = await renderInvoicePdf((await loadInvoice({ id: order.id }))!);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).not.toContain(privateSite.pickupAddress);

    const res = await GET(new Request("http://x"), { params: Promise.resolve({ token: order.viewToken }) });
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain(invoiceFileName(order.orderNumber));
    expect((await GET(new Request("http://x"), { params: Promise.resolve({ token: "x".repeat(24) }) })).status).toBe(404);
  });

  it("is attached to the order confirmation email only", async () => {
    const order = await createPaidOrder();
    const d = (await loadOrderEmailData(order.id))!;
    const receipt = await buildEmail("customer-receipt", d);
    expect(receipt.attachments?.[0]).toMatchObject({ filename: invoiceFileName(order.orderNumber), contentType: "application/pdf" });
    expect(receipt.html).toContain("/invoice");
    expect((await buildEmail("owner-new-order", d)).attachments).toBeUndefined();
  });

  it("keeps file names printable in the PDF's fonts", () => {
    expect(pdfSafe("dragon – v2 “final”.stl")).toBe('dragon - v2 "final".stl');
    expect(pdfSafe("龍.stl × 2 · PLA")).toBe("?.stl × 2 · PLA");
  });
});
