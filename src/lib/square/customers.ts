import "server-only";
import { createHash } from "node:crypto";
import { SquareError } from "square";
import { getSquare } from "./client";

export type CustomerDetails = { name: string; email: string; phone: string };

/** Square wants E.164 (+16045550123). Returns null if we can't be sure. */
export function toE164(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

/**
 * Finds the customer in Square by email, or creates them. Returns the
 * Square customer id. Throws if Square can't be reached (callers decide
 * whether that matters).
 */
export async function findOrCreateSquareCustomer(c: CustomerDetails): Promise<string> {
  const square = getSquare();
  const email = c.email.trim().toLowerCase();

  const found = await square.customers.search({ limit: BigInt(1), query: { filter: { emailAddress: { exact: email } } } });
  const existing = found.customers?.[0]?.id;
  if (existing) return existing;

  const [givenName, ...rest] = c.name.trim().split(/\s+/);
  const base = {
    // Same email = same key, so a retry can't create a duplicate customer.
    idempotencyKey: `cp-cust-${createHash("sha256").update(email).digest("hex").slice(0, 32)}`,
    givenName,
    familyName: rest.join(" ") || undefined,
    emailAddress: email,
    note: "Created by coastlineprints.ca",
  };
  const phone = toE164(c.phone);
  try {
    const { customer } = await square.customers.create({ ...base, phoneNumber: phone ?? undefined });
    if (!customer?.id) throw new Error("Square returned no customer");
    return customer.id;
  } catch (err) {
    // A phone number Square doesn't like shouldn't stop us saving the customer.
    if (phone && err instanceof SquareError && err.statusCode === 400) {
      const { customer } = await square.customers.create({ ...base, idempotencyKey: `${base.idempotencyKey}-np` });
      if (customer?.id) return customer.id;
    }
    throw err;
  }
}

/** Gives up after `ms` so a slow Square never holds up a payment. */
export async function findOrCreateWithTimeout(c: CustomerDetails, ms = 4000): Promise<string | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      findOrCreateSquareCustomer(c),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
