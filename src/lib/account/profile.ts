import "server-only";
import { db } from "@/lib/db";
import { consumeCode, createLoginCode, LoginError, normalizeEmail, squareSyncEnabled } from "./auth";

export type Theme = "light" | "dark";
export type Profile = { email: string; name: string; phone: string; theme: Theme | null };

type Account = { id: string; email: string; name: string | null; phone: string | null; theme: string | null };

/** Their saved details, filled in from their latest order where they haven't set them yet. */
export async function profileFor(account: Account): Promise<Profile> {
  const last =
    account.name && account.phone ? null : await db.order.findFirst({ where: { customerEmail: account.email }, orderBy: { createdAt: "desc" }, select: { customerName: true, customerPhone: true } });
  return {
    email: account.email,
    name: account.name ?? last?.customerName ?? "",
    phone: account.phone ?? last?.customerPhone ?? "",
    theme: account.theme === "light" || account.theme === "dark" ? account.theme : null,
  };
}

/** The first name to greet them by. */
export function firstName(profile: Pick<Profile, "name" | "email">) {
  return profile.name.trim().split(/\s+/)[0] || profile.email.split("@")[0].replace(/^./, (c) => c.toUpperCase());
}

/** Saves name, phone and theme. Name or phone changes are sent on to their Square customer. */
export async function updateProfile(account: Account, data: { name?: string; phone?: string; theme?: Theme }) {
  const next = {
    name: data.name !== undefined ? data.name.trim() || null : undefined,
    phone: data.phone !== undefined ? data.phone.trim() || null : undefined,
    theme: data.theme,
  };
  await db.customer.update({ where: { id: account.id }, data: next });
  const changed = (next.name !== undefined && next.name !== account.name) || (next.phone !== undefined && next.phone !== account.phone);
  if (changed) await queueSquareUpdate(account.id);
}

/** Fills in a missing name or phone from an order they just placed while signed in. */
export async function rememberOrderDetails(accountId: string, email: string, details: { name: string; phone: string }) {
  await db.customer.updateMany({ where: { id: accountId, email, name: null }, data: { name: details.name } });
  await db.customer.updateMany({ where: { id: accountId, email, phone: null }, data: { phone: details.phone } });
}

/** Codes for an email change are kept apart from sign-in codes, so one can't be used as the other. */
const changeKey = (customerId: string, email: string) => `change:${customerId}:${email}`;

/** Makes a code to confirm a new email address. Returns null if that email already has an account. */
export async function startEmailChange(account: Account, newEmail: string) {
  const email = normalizeEmail(newEmail);
  if (email === account.email) throw new LoginError("That's already your email.");
  if (await db.customer.findUnique({ where: { email }, select: { id: true } })) throw new LoginError("That email already has its own account.");
  return { email, code: await createLoginCode(changeKey(account.id, email)) };
}

/**
 * Checks the code sent to the new address, then moves the account to it.
 * Their past orders and reward points move with them, so nothing is lost.
 */
export async function finishEmailChange(account: Account, newEmail: string, code: string) {
  const email = normalizeEmail(newEmail);
  await consumeCode(changeKey(account.id, email), code);
  await db.$transaction(async (tx) => {
    if (await tx.customer.findUnique({ where: { email }, select: { id: true } })) throw new LoginError("That email already has its own account.");
    await tx.customer.update({ where: { id: account.id }, data: { email } });
    await tx.order.updateMany({ where: { customerEmail: account.email }, data: { customerEmail: email } });
    await tx.pointsEntry.updateMany({ where: { email: account.email }, data: { email } });
  });
  await queueSquareUpdate(account.id);
  return email;
}

/**
 * Sends their new details to their Square customer (see the outbox's
 * account-update job, which never makes a duplicate). Only with production or
 * sandbox keys, like the first sync.
 */
async function queueSquareUpdate(customerId: string) {
  if (!squareSyncEnabled()) return;
  // One pending update per account is enough: it reads the latest details when it runs.
  const pending = await db.outboxJob.findFirst({ where: { kind: "square", template: "account-update", status: "PENDING", payload: { contains: customerId } } });
  if (pending) return;
  await db.outboxJob.create({
    data: { kind: "square", template: "account-update", payload: JSON.stringify({ orderId: "", customerId }), dedupeKey: `${customerId}:account-update:${Date.now()}` },
  });
}
