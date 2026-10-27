import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { startSession } from "@/lib/account/auth";
import { emailForLink, safeNext } from "@/lib/account/link";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { THEME_COOKIE, THEME_COOKIE_OPTIONS } from "@/lib/theme";

export const runtime = "nodejs";

/** A sign-in link from an email: signs the browser in and opens the page it points to. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  if (!rateLimit(`link:${clientIp(req)}`, 30, 15 * 60_000).ok) return NextResponse.redirect(`${appUrl()}/account`);
  const email = await emailForLink(url.searchParams.get("t") ?? "");
  // Expired or wrong: the account page, where they can ask for a code.
  if (!email) return NextResponse.redirect(`${appUrl()}/account?link=expired`);
  const now = new Date();
  const customer = await db.customer.upsert({ where: { email }, create: { email, lastSeenAt: now }, update: { lastSeenAt: now } });
  await startSession(customer.id, now);
  if (customer.theme === "light" || customer.theme === "dark") (await cookies()).set(THEME_COOKIE, customer.theme, THEME_COOKIE_OPTIONS);
  return NextResponse.redirect(`${appUrl()}${next}`);
}
