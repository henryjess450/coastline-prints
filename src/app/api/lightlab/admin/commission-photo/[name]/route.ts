import { apiError } from "@/lib/api";
import { requestIsAdmin } from "@/lib/admin/auth";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** A photo sent with a commission request. Admin only: customers' photos are never public. */
export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const name = (await ctx.params).name;
  const m = /^[a-f0-9]{24}\.(jpg|png|webp)$/.exec(name);
  if (!m) return apiError(404, "Not found.");
  try {
    const data = await getStorage().get(`commission/${name}`);
    return new Response(new Uint8Array(data), { headers: { "Content-Type": TYPES[m[1]], "Cache-Control": "private, max-age=86400" } });
  } catch {
    return apiError(404, "Not found.");
  }
}
