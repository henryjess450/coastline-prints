import { NextResponse } from "next/server";
import { z } from "zod";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api";
import { pairByCode } from "@/lib/pos/register.server";

export const runtime = "nodejs";

/** The cashier types the code shown on the customer display. */
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const parsed = z.object({ code: z.string().max(20) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Enter the code on the display.");
  const r = await pairByCode(parsed.data.code);
  if (!r) return apiError(404, "No display is showing that code. Check it, or reload the display.");
  return NextResponse.json({ registerId: r.id });
}
