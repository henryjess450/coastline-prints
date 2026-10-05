import { apiError, logError } from "@/lib/api";
import { requestIsAdmin } from "@/lib/admin/auth";
import { renderCodeSlipPng } from "@/lib/receipt/code-slip";

export const runtime = "nodejs";

/** The coupon / gift card slip exactly as it prints. Admin only. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const { id } = await ctx.params;
  try {
    const { png } = await renderCodeSlipPng(id);
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("admin:slip", err);
    return apiError(404, "Code not found.");
  }
}
