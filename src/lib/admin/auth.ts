import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Single-admin login from ADMIN_USERNAME / ADMIN_PASSWORD.
 * The session is a signed, expiring cookie (no server-side session store).
 * The signing key is derived from AUTH_SECRET (if set) and the admin
 * password, so changing the password logs out every existing session.
 */

export const SESSION_COOKIE = "cp_admin";
const SESSION_DAYS = 14;

export function adminConfigured() {
  return !!(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD);
}

function signingKey() {
  return createHash("sha256")
    .update(`coastline-admin:${process.env.AUTH_SECRET ?? ""}:${process.env.ADMIN_USERNAME ?? ""}:${process.env.ADMIN_PASSWORD ?? ""}`)
    .digest();
}

function sign(payload: string) {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkCredentials(username: string, password: string) {
  if (!adminConfigured()) return false;
  // Compare both, always, so timing doesn't reveal which one was wrong.
  const u = safeEqual(username, process.env.ADMIN_USERNAME!);
  const p = safeEqual(password, process.env.ADMIN_PASSWORD!);
  return u && p;
}

export function createSessionToken(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ u: process.env.ADMIN_USERNAME, exp: now + SESSION_DAYS * 86_400_000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()) {
  if (!token || !adminConfigured()) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u?: string; exp?: number };
    return data.u === process.env.ADMIN_USERNAME && typeof data.exp === "number" && data.exp > now;
  } catch {
    return false;
  }
}

export async function setSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function isAdmin() {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** For pages and server actions: sends anyone not logged in to the login page. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

/** For API route handlers: true if the request carries a valid admin session. */
export function requestIsAdmin(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return verifySessionToken(token ? decodeURIComponent(token) : undefined);
}
