import { NextResponse } from "next/server";
import { z } from "zod";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api";
import { joinUpdates } from "@/lib/pos/join.server";

export const runtime = "nodejs";

const body = z.object({
  email: z.string().trim().toLowerCase().email("That email doesn't look right.").max(200),
  name: z.string().trim().max(100).optional(),
  source: z.string().trim().max(60).optional(),
});

/** Join LightLab updates from the register iPad turned around (no paired display). */
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Please log in again.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Check the email.");
  const created = await joinUpdates(parsed.data.email, parsed.data.name ?? null, parsed.data.source ?? null);
  return NextResponse.json({ created });
}
