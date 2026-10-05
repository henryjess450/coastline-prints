"use server";
import { headers } from "next/headers";
import { findOrderForCustomer, type CustomerOrderView } from "@/lib/orders/lookup";
import { rateLimit } from "@/lib/ratelimit";

export type LookupState = { order?: CustomerOrderView; error?: string };

export async function lookupOrderAction(_: LookupState, form: FormData): Promise<LookupState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = rateLimit(`status:${ip}`, 20, 10 * 60_000);
  if (!limit.ok) return { error: "Too many lookups. Please wait a few minutes." };

  const orderNumber = String(form.get("orderNumber") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  if (!/^CP-\d{4}-[A-Z0-9]{4}$/i.test(orderNumber) || !email.includes("@")) {
    return { error: "Enter your order number (like CP-2610-AB2C) and the email you ordered with." };
  }
  const order = await findOrderForCustomer(orderNumber, email);
  // Same message either way, so this can't be used to check which emails have ordered.
  if (!order) return { error: "We couldn't find an order with that number and email. Check your receipt email for both." };
  return { order };
}
