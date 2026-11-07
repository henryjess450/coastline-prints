import { isAdmin } from "@/lib/admin/auth";
import { cardBatch, cardBatchCodes } from "@/lib/codes/thank-you";
import { cardBatchPdf } from "@/lib/codes/thank-you-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A batch of thank-you cards as a PDF to print, twelve to a page. Admin only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Not found", { status: 404 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}$/.test(id)) return new Response("Not found", { status: 404 });
  const batch = await cardBatch(id);
  if (!batch) return new Response("Not found", { status: 404 });
  const pdf = await cardBatchPdf(batch, await cardBatchCodes(id));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="lightlab-thank-you-cards-${id}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
