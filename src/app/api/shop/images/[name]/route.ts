import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Product photos, stored under shop/. Names are random, so they cache forever. */
export async function GET(_: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const m = /^([a-z0-9]{16,40})\.(jpg|png|webp)$/.exec(name);
  if (!m) return new Response("Not found", { status: 404 });
  try {
    const data = await getStorage().get(`shop/${name}`);
    return new Response(Buffer.from(data), { headers: { "Content-Type": TYPES[m[2]], "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
