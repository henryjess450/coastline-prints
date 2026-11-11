import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, logError } from "@/lib/api";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { createHold, HoldError } from "@/lib/shop/stand.server";

export const runtime = "nodejs";

const body = z.object({
  productId: z.string().min(1).max(40),
  variantId: z.string().max(40).nullable().default(null),
  quantity: z.number().int().min(1).max(5).default(1),
  name: z.string().trim().min(1, "Add your name.").max(100),
  email: z.string().trim().toLowerCase().email("That email doesn't look right.").max(200),
  phone: z.string().trim().max(30).default(""),
  slotStart: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time you'll come by."),
});

/** Hold a lamp at the stand for free: pay when you pick it up. */
export async function POST(req: Request) {
  const limit = rateLimit(`stand-hold:${clientIp(req)}`, 6, 60 * 60_000);
  if (!limit.ok) return apiError(429, "That's a lot of holds. Please come by the stand!");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Please check the details.");
  try {
    const hold = await createHold(parsed.data);
    sendNotificationsSoon("stand-hold");
    return NextResponse.json({ token: hold.token });
  } catch (err) {
    if (err instanceof HoldError) return apiError(409, err.message);
    logError("stand:hold", err);
    return apiError(500, "Couldn't hold it. Please try again.");
  }
}
