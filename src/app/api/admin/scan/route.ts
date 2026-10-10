import { NextResponse } from "next/server";
import { z } from "zod";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError, logError } from "@/lib/api";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { scanOrder } from "@/lib/orders/scan";

export const runtime = "nodejs";

const body = z.object({ code: z.string().trim().min(1).max(300), tracking: z.string().trim().max(60).optional() });

/** A scan at the scan station: moves that order on a step (admin only). */
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Log in to the admin on this computer first.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Nothing was scanned.");
  try {
    const result = await scanOrder(parsed.data.code, { tracking: parsed.data.tracking });
    // Send the customer email (if any) and print the stub.
    if (result.ok) sendNotificationsSoon("scan");
    return NextResponse.json(result);
  } catch (err) {
    logError("scan", err);
    return apiError(500, "That scan didn't save. Try again.");
  }
}
