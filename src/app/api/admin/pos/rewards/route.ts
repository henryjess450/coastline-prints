import { NextResponse } from "next/server";
import { z } from "zod";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError, logError } from "@/lib/api";
import { RedeemError } from "@/lib/rewards/server";
import { findRewardsCustomer, redeemForSale, undoStandRedeem } from "@/lib/rewards/stand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The register: find a customer by phone or email and see their points. */
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const parsed = z.object({ q: z.string().trim().min(3).max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Type a phone number or email.");
  try {
    const p = await findRewardsCustomer(parsed.data.q);
    return p ? NextResponse.json(p) : apiError(404, "No customer with that phone number or email.");
  } catch (err) {
    logError("pos:rewards-find", err);
    return apiError(502, "Couldn't look that up.");
  }
}

/** Spend their points on money off this sale. */
export async function PUT(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), prizeId: z.string().min(1).max(40) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Pick a prize.");
  try {
    const r = await redeemForSale(parsed.data.email, parsed.data.prizeId);
    return NextResponse.json({ code: r.code, label: r.label, points: r.balance });
  } catch (err) {
    if (err instanceof RedeemError) return apiError(409, err.message);
    logError("pos:rewards-redeem", err);
    return apiError(502, "That didn't work. Try again.");
  }
}

/** Sale cleared without paying: the points go back. */
export async function DELETE(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (code) await undoStandRedeem(code).catch((e) => logError("pos:rewards-undo", e));
  return NextResponse.json({ ok: true });
}
