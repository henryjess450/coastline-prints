import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, logError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { DISPLAY_COOKIE, displayByToken, OrderFormError, replyFromDisplay } from "@/lib/pos/register.server";
import { posOrderDetailsSchema } from "@/lib/pos/types";

export const runtime = "nodejs";

const body = z.object({
  popupId: z.string().min(1).max(40),
  kind: z.enum(["email", "account", "order", "dismiss"]),
  email: z.string().trim().toLowerCase().email("That email doesn't look right.").max(200).optional(),
  name: z.string().trim().max(100).optional(),
  order: posOrderDetailsSchema.optional(),
});

/** The customer answered the popup on the display (an email, joining rewards, their order details, or closing it). */
export async function POST(req: Request) {
  const limit = rateLimit(`pos-reply:${clientIp(req)}`, 30, 10 * 60_000);
  if (!limit.ok) return apiError(429, "Too many tries. Ask at the counter.");
  const r = await displayByToken((await cookies()).get(DISPLAY_COOKIE)?.value);
  if (!r?.pairedAt) return apiError(404, "Not set up.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Check the details.");
  try {
    const reply = await replyFromDisplay(r, parsed.data);
    if (!reply) return apiError(409, "That question isn't showing any more.");
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof OrderFormError) return apiError(400, err.message);
    logError("pos:reply", err);
    return apiError(500, "That didn't work. Try again.");
  }
}
