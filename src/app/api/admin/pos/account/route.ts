import { NextResponse } from "next/server";
import { z } from "zod";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError, logError } from "@/lib/api";
import { joinRewards } from "@/lib/pos/register.server";

export const runtime = "nodejs";

const body = z.object({ email: z.string().trim().toLowerCase().email("That email doesn't look right.").max(200), name: z.string().trim().max(100).optional() });

/** Join rewards typed on the register iPad turned around (a paired display uses /api/pos/display/reply). */
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Check the email.");
  try {
    return NextResponse.json({ created: await joinRewards(parsed.data.email, parsed.data.name ?? null) });
  } catch (err) {
    logError("pos:account", err);
    return apiError(500, "That didn't work. Try again.");
  }
}
