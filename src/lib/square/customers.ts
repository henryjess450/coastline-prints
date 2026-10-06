import "server-only";
import { createHash } from "node:crypto";
import { SquareError } from "square";
import { db } from "@/lib/db";
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One lookup-or-create per email at a time in this server, so two requests can't race to create the same customer. */
const inFlight = new Map<string, Promise<string>>();

/**
 * Finds the customer in Square by email, or creates them, and NEVER makes a
 * duplicate. Returns the Square customer id. Throws if Square can't be
 * reached (callers decide whether that matters). Every Square customer must
 * be made through here.
 *
 * Guards against duplicates:
 * - only one lookup-or-create per email runs at a time;
 * - Square is searched by email first;
 * - if search finds nothing, a Square id we already saved for this email is
 *   checked directly (Square's search can lag a few seconds behind a create);
 * - creates use an idempotency key made from the email, so a retry returns
 *   the same customer; if Square reports the key was already used, we search
 *   again instead of creating with a new key.
 */
export function findOrCreateSquareCustomer(c: CustomerDetails): Promise<string> {
  const email = c.email.trim().toLowerCase();
  const running = inFlight.get(email);
  if (running) return running;
  const task = findOrCreate({ ...c, email }).finally(() => inFlight.delete(email));
  inFlight.set(email, task);
  return task;
}

async function searchByEmail(email: string) {
  const found = await getSquare().customers.search({ limit: BigInt(1), query: { filter: { emailAddress: { exact: email } } } });
  return found.customers?.[0]?.id ?? null;
}

/** A Square id we've already saved for this email (account or past order), if it still exists in Square. */
async function knownId(email: string) {
  const account = await db.customer.findUnique({ where: { email }, select: { squareCustomerId: true } });
  const order = account?.squareCustomerId ? null : await db.order.findFirst({ where: { customerEmail: email, squareCustomerId: { not: null } }, orderBy: { createdAt: "desc" }, select: { squareCustomerId: true } });
  const id = account?.squareCustomerId ?? order?.squareCustomerId;
  if (!id) return null;
  try {
    const { customer } = await getSquare().customers.get({ customerId: id });
    return customer?.id ?? null;
  } catch (err) {
    if (err instanceof SquareError && err.statusCode === 404) return null; // deleted in Square
    throw err;
  }
}

/** Remembers the id on the account (if they have one), so it's reused from now on. */
async function remember(email: string, id: string) {
  await db.customer.updateMany({ where: { email, squareCustomerId: null }, data: { squareCustomerId: id } });
  return id;
}

async function findOrCreate(c: CustomerDetails): Promise<string> {
  const email = c.email;
  const existing = (await searchByEmail(email)) ?? (await knownId(email));
  if (existing) return remember(email, existing);

  const [givenName, ...rest] = c.name.trim().split(/\s+/);
  const base = {
    // Same email = same key, so a retry can't create a duplicate customer.
    idempotencyKey: `cp-cust-${createHash("sha256").update(email).digest("hex").slice(0, 32)}`,
    givenName: givenName || undefined,
    familyName: rest.join(" ") || undefined,
    emailAddress: email,
    note: "Created by coastlineprints.ca",
  };
  const phone = toE164(c.phone);
  const codes = (err: unknown) => (err instanceof SquareError ? err.errors.map((e) => `${e.code ?? ""} ${e.field ?? ""}`).join(" ") : "");

  try {
    const { customer } = await getSquare().customers.create({ ...base, phoneNumber: phone ?? undefined });
    if (!customer?.id) throw new Error("Square returned no customer");
    return remember(email, customer.id);
  } catch (err) {
    // The key was already used: the customer exists (maybe made a moment ago). Find it rather than make another.
    if (/IDEMPOTENCY/i.test(codes(err))) {
      for (let i = 0; i < 4; i++) {
        await sleep(1500);
        const id = await searchByEmail(email);
        if (id) return remember(email, id);
      }
      throw err;
    }
    // Only a phone number Square rejects (and only that) gets a second try without it.
    if (phone && /PHONE/i.test(codes(err))) {
      const again = await searchByEmail(email);
      if (again) return remember(email, again);
      const { customer } = await getSquare().customers.create({ ...base, idempotencyKey: `${base.idempotencyKey}-np` });
      if (customer?.id) return remember(email, customer.id);
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
