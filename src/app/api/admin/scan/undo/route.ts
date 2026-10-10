import { NextResponse } from "next/server";
import { z } from "zod";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError, logError } from "@/lib/api";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { undoScan } from "@/lib/orders/scan";

export const runtime = "nodejs";

const body = z.object({ orderId: z.string().min(1).max(40), from: z.string().min(1).max(30), to: z.string().min(1).max(30) });

/** Puts a scanned order back where it was (admin only). */
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Log in to the admin on this computer first.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Nothing to undo.");
  try {
    const result = await undoScan(parsed.data.orderId, parsed.data.from, parsed.data.to);
    if (result.ok) sendNotificationsSoon("scan-undo");
    return NextResponse.json(result);
  } catch (err) {
    logError("scan:undo", err);
    return apiError(500, "That didn't undo. Try again.");
  }
}
