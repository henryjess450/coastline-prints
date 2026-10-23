import { apiError, logError } from "@/lib/api";
import { requestIsAdmin } from "@/lib/admin/auth";
import { renderAlignmentPdf } from "@/lib/label/render";

export const runtime = "nodejs";

/** A plain-paper test page showing where each Avery 8168 label prints. Admin only. */
export async function GET(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  try {
    const pdf = await renderAlignmentPdf();
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="label-alignment-test.pdf"', "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("admin:label-alignment", err);
    return apiError(500, "Couldn't make the test page.");
  }
}
