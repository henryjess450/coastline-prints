import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import { normalizeEmail } from "./auth";

/**
 * Sign-in links for emails (the order confirmation for orders taken at the
 * register): one tap signs them in, no code to type. Kept in the LoginCode
 * table under "link:<email>" so they never touch the 6-digit codes. A link
 * works until it expires rather than once, so a mail app opening it to check
 * for spam doesn't use it up.
 */

const LINK_DAYS = 14;
const hash = (secret: string) => createHash("sha256").update(`coastline-link:${process.env.AUTH_SECRET ?? ""}:${secret}`).digest("hex");

/** A link that signs this email in, then opens `next` (a path on this site). */
export async function createSignInLink(rawEmail: string, next: string, now = new Date()) {
  const secret = randomBytes(24).toString("base64url");
  const row = await db.loginCode.create({ data: { email: `link:${normalizeEmail(rawEmail)}`, codeHash: hash(secret), expiresAt: new Date(now.getTime() + LINK_DAYS * 86_400_000) } });
  return `${appUrl()}/api/account/link?t=${row.id}.${secret}&next=${encodeURIComponent(safeNext(next))}`;
}

/** The email a link signs in, or null if it's wrong or expired. */
export async function emailForLink(token: string, now = new Date()) {
  const [id, secret] = token.split(".");
  if (!id || !secret) return null;
  const row = await db.loginCode.findUnique({ where: { id } });
  if (!row || !row.email.startsWith("link:") || row.expiresAt <= now) return null;
  const a = Buffer.from(row.codeHash);
  const b = Buffer.from(hash(secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return row.email.slice("link:".length);
}

/** Only paths on this site, never another one ("//evil.com"). */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/account";
}
