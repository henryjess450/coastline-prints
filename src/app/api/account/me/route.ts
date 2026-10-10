import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/account/auth";
import { profileFor, updateProfile } from "@/lib/account/profile";
import { apiError } from "@/lib/api";
import { addressSchema } from "@/lib/checkout/schema";
import { THEME_COOKIE, THEME_COOKIE_OPTIONS } from "@/lib/theme";

export const runtime = "nodejs";

/** The signed-in customer's details, for filling in checkout. */
export async function GET(req: Request) {
  const customer = await customerFromRequest(req);
  if (!customer) return NextResponse.json({ signedIn: false });
  return NextResponse.json({ signedIn: true, ...(await profileFor(customer)) });
}

const body = z.object({
  name: z.string().trim().max(120).refine((v) => v === "" || v.length >= 2, "Please enter your full name.").optional(),
  phone: z.string().trim().max(40).refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Please enter a phone number with area code.").optional(),
  theme: z.enum(["light", "dark"]).optional(),
  /** News and offers emails on or off. */
  news: z.boolean().optional(),
  /** null removes the saved address. */
  address: addressSchema.nullable().optional(),
});

/** Saves their name, phone, shipping address and light or dark choice. */
export async function PATCH(req: Request) {
  const customer = await customerFromRequest(req);
  if (!customer) return apiError(401, "Please sign in again.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Please check your details.");
  await updateProfile(customer, parsed.data);
  if (parsed.data.theme) (await cookies()).set(THEME_COOKIE, parsed.data.theme, THEME_COOKIE_OPTIONS);
  return NextResponse.json({ ok: true });
}
