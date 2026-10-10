import { invoiceFileName, loadInvoice } from "@/lib/invoice/data";
import { renderInvoicePdf } from "@/lib/invoice/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The invoice as a PDF download, by the order's private link. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{20,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const invoice = await loadInvoice({ viewToken: token });
  if (!invoice) return new Response("Not found", { status: 404 });
  const pdf = await renderInvoicePdf(invoice);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceFileName(invoice.orderNumber)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
