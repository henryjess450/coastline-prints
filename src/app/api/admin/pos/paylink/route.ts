import { NextResponse } from "next/server";
import { z } from "zod";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError, logError } from "@/lib/api";
import { cancelPayLink, createPayLink, payLinkStatus, payLinksAvailable } from "@/lib/pos/paylink.server";

export const runtime = "nodejs";

const create = z.object({ attemptId: z.string().uuid(), amountCents: z.number().int().min(100).max(10_000_000), brand: z.enum(["lightlab", "coastline"]) });

/** A Square payment link for the sale's total, shown as a QR code on the display. */
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  if (!payLinksAvailable()) return apiError(503, "Square isn't set up on this server.");
  const parsed = create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Payment links need at least $1.00.");
  try {
    return NextResponse.json(await createPayLink(parsed.data.attemptId, parsed.data.amountCents, parsed.data.brand));
  } catch (err) {
    logError("pos:paylink", err);
    return apiError(502, "Square didn't make the link. Try again, or take the card on the reader.");
  }
}

/** Has the link been paid? ?orderId=... */
export async function GET(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const orderId = new URL(req.url).searchParams.get("orderId") ?? "";
  if (!orderId || orderId.length > 80) return apiError(400, "Missing order.");
  try {
    return NextResponse.json(await payLinkStatus(orderId), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logError("pos:paylink-status", err);
    return apiError(502, "Couldn't check with Square.");
  }
}

/** Stop a link (cart changed, or paid another way). ?linkId=... */
export async function DELETE(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const linkId = new URL(req.url).searchParams.get("linkId") ?? "";
  if (!linkId || linkId.length > 80) return apiError(400, "Missing link.");
  await cancelPayLink(linkId).catch((e) => logError("pos:paylink-cancel", e));
  return NextResponse.json({ ok: true });
}
