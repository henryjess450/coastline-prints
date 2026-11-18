import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, logError } from "@/lib/api";
import { pairedKiosk } from "@/lib/kiosk/server";
import { RedeemError } from "@/lib/rewards/server";
import { findRewardsCustomer, maskEmail, redeemForSale, rewardsRef, undoStandRedeem } from "@/lib/rewards/stand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * "Shopped with us before?" on the self-checkout: type a phone number or email
 * to fill in your name, see your points and spend them on money off this sale.
 * The tablet gets the email only partly hidden, plus a signed ref the sale uses
 * for the real one, so typing someone's number doesn't show their email.
 */

const lookup = z.object({ q: z.string().trim().min(3).max(200) });
const redeem = lookup.extend({ prizeId: z.string().min(1).max(40) });

/** A few lookups a minute per tablet, so nobody can fish through phone numbers. */
const tries = new Map<string, number[]>();
function tooMany(kioskId: string) {
  const now = Date.now();
  const recent = (tries.get(kioskId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  tries.set(kioskId, recent);
  return recent.length > 8;
}

const publicView = (p: NonNullable<Awaited<ReturnType<typeof findRewardsCustomer>>>) => ({ firstName: p.name.trim().split(/\s+/)[0] ?? "", name: p.name.trim(), maskedEmail: maskEmail(p.email), ref: rewardsRef(p.email), points: p.points, prizes: p.prizes });

/** Find me: phone or email → first name, points and what they can get. */
export async function POST(req: Request) {
  const kiosk = await pairedKiosk();
  if (!kiosk) return apiError(401, "This kiosk isn't paired.");
  const parsed = lookup.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Type your phone number or email.");
  if (tooMany(kiosk.id)) return apiError(429, "Too many tries. Please wait a minute.");
  try {
    const p = await findRewardsCustomer(parsed.data.q);
    return p ? NextResponse.json(publicView(p)) : apiError(404, "We couldn't find you. Check the number or email, or skip this.");
  } catch (err) {
    logError("kiosk:rewards-find", err);
    return apiError(502, "Couldn't look that up. Please try again.");
  }
}

/** Spend points: a one-use coupon for this sale. */
export async function PUT(req: Request) {
  const kiosk = await pairedKiosk();
  if (!kiosk) return apiError(401, "This kiosk isn't paired.");
  const parsed = redeem.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Pick a prize.");
  try {
    const p = await findRewardsCustomer(parsed.data.q);
    if (!p) return apiError(404, "We couldn't find you.");
    const r = await redeemForSale(p.email, parsed.data.prizeId);
    return NextResponse.json({ code: r.code, label: r.label, points: r.balance });
  } catch (err) {
    if (err instanceof RedeemError) return apiError(409, err.message);
    logError("kiosk:rewards-redeem", err);
    return apiError(502, "That didn't work. Please try again.");
  }
}

/** The sale didn't happen: the points go back. */
export async function DELETE(req: Request) {
  const kiosk = await pairedKiosk();
  if (!kiosk) return apiError(401, "This kiosk isn't paired.");
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (code) await undoStandRedeem(code).catch((e) => logError("kiosk:rewards-undo", e));
  return NextResponse.json({ ok: true });
}
