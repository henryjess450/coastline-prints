import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, logError } from "@/lib/api";
import { processOutbox } from "@/lib/notify/outbox";

export const runtime = "nodejs";

/** For schedulers (e.g. Vercel Cron): `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) return apiError(401, "Unauthorized");
  try {
    return NextResponse.json(await processOutbox({ limit: 50 }));
  } catch (err) {
    logError("cron:outbox", err);
    return apiError(500, "Outbox run failed");
  }
}
