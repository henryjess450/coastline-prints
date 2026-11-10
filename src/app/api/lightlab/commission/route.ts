import { NextResponse } from "next/server";
import { apiError, logError } from "@/lib/api";
import { CommissionError, commissionRequestSchema, createCommission } from "@/lib/commissions/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** "Make me a lamp": the request form (fields plus up to 4 photos, as one multipart post). */
export async function POST(req: Request) {
  const limit = rateLimit(`commission:${clientIp(req)}`, 5, 60 * 60_000);
  if (!limit.ok) return apiError(429, "That's a lot of requests. Please try again in a while, or email us.");
  const form = await req.formData().catch(() => null);
  if (!form) return apiError(400, "Invalid request.");
  const str = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : "");
  const parsed = commissionRequestSchema.safeParse({ name: str("name"), email: str("email"), phone: str("phone"), idea: str("idea"), shade: str("shade"), shadeHex: str("shadeHex") || null, neededBy: str("neededBy") });
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Please check the form.");
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  try {
    const row = await createCommission(parsed.data, files);
    return NextResponse.json({ token: row.token });
  } catch (err) {
    if (err instanceof CommissionError) return apiError(400, err.message);
    logError("commission:create", err);
    return apiError(500, "Couldn't send that. Please try again.");
  }
}
