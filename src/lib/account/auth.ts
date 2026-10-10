import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * Customer accounts, signed in with a 6-digit code sent by email (no
 * passwords). Codes are stored hashed and expire after a few minutes and a
 * few wrong tries. The session cookie holds a random token; the database only
 * keeps its hash, so a leaked database can't be used to sign in.
 */

export const ACCOUNT_COOKIE = "cp_account";
const SESSION_DAYS = 60;
export const CODE_MINUTES = 10;
const CODE_TRIES = 5;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const codeHash = (email: string, code: string) => sha256(`coastline-login:${process.env.AUTH_SECRET ?? ""}:${email}:${code}`);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Makes a new sign-in code for this email (older unused ones stop working). */
export async function createLoginCode(email: string, now = new Date()) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.$transaction([
    db.loginCode.updateMany({ where: { email, usedAt: null }, data: { usedAt: now } }),
    db.loginCode.create({ data: { email, codeHash: codeHash(email, code), expiresAt: new Date(now.getTime() + CODE_MINUTES * 60_000) } }),
  ]);
  return code;
}

export class LoginError extends Error {}

/**
 * Checks and uses up a code made by createLoginCode for `key` (an email, or
 * an email-change key). Throws a LoginError if it's wrong, old or used.
 */
export async function consumeCode(email: string, code: string, now = new Date()) {
  const row = await db.loginCode.findFirst({ where: { email, usedAt: null }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt <= now) throw new LoginError("That code has expired. Please ask for a new one.");
  if (row.attempts >= CODE_TRIES) throw new LoginError("Too many wrong tries. Please ask for a new code.");
  const a = Buffer.from(row.codeHash);
  const b = Buffer.from(codeHash(email, code.replace(/\D/g, "")));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    throw new LoginError("That code doesn't match. Check the email and try again.");
  }
  const { count } = await db.loginCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (count !== 1) throw new LoginError("That code was already used. Please ask for a new one.");
}

/** Checks a code. On success, returns the customer (creating the account on first sign-in). */
export async function verifyLoginCode(email: string, code: string, now = new Date()) {
  await consumeCode(email, code, now);
  const customer = await db.customer.upsert({ where: { email }, create: { email, lastSeenAt: now }, update: { lastSeenAt: now } });
  if (!customer.squareCustomerId) await queueSquareSync(customer.id);
  return customer;
}

/**
 * Saves the account to Square's customer list in the background (found by
 * email or created, never duplicated; see square/customers). Queued once per
 * account; a job that gave up earlier is retried on the next sign-in.
 * Only with production or sandbox Square keys, so local testing with the
 * live keys never adds test customers to the real Square account.
 */
/**
 * The owner sets up an account for someone from the admin panel. Same as
 * signing up (including the one-time Square sync, which never duplicates).
 * Null if that email already has an account.
 */
export async function createInvitedAccount(rawEmail: string, name: string | null, now = new Date()) {
  const email = normalizeEmail(rawEmail);
  if (await db.customer.findUnique({ where: { email }, select: { id: true } })) return null;
  const customer = await db.customer.create({ data: { email, name: name?.trim() || null, invitedAt: now } });
  await queueSquareSync(customer.id);
  return customer;
}

export function squareSyncEnabled() {
  if (!process.env.SQUARE_ACCESS_TOKEN) return false;
  return process.env.NODE_ENV === "production" || process.env.SQUARE_ENVIRONMENT === "sandbox";
}

async function queueSquareSync(customerId: string) {
  if (!squareSyncEnabled()) return;
  const dedupeKey = `${customerId}:account-sync`;
  await db.outboxJob.upsert({
    where: { dedupeKey },
    create: { kind: "square", template: "account-sync", payload: JSON.stringify({ orderId: "", customerId }), dedupeKey },
    update: {},
  });
  await db.outboxJob.updateMany({ where: { dedupeKey, status: "FAILED" }, data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date() } });
}

/** Signs this browser in as the customer. */
export async function startSession(customerId: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  await db.customerSession.create({ data: { tokenHash: sha256(token), customerId, expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000) } });
  (await cookies()).set(ACCOUNT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

async function customerForToken(token: string | undefined, now = new Date()) {
  if (!token) return null;
  const session = await db.customerSession.findUnique({ where: { tokenHash: sha256(token) }, include: { customer: true } });
  if (!session || session.expiresAt <= now) return null;
  return session.customer;
}

/** The signed-in customer, for pages and server actions. */
export async function currentCustomer() {
  return customerForToken((await cookies()).get(ACCOUNT_COOKIE)?.value);
}

/** The signed-in customer, for API routes. */
export async function customerFromRequest(req: Request) {
  const token = (req.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ACCOUNT_COOKIE}=`))
    ?.slice(ACCOUNT_COOKIE.length + 1);
  return customerForToken(token ? decodeURIComponent(token) : undefined);
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(ACCOUNT_COOKIE)?.value;
  if (token) await db.customerSession.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(ACCOUNT_COOKIE);
}
