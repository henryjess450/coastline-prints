import type { Metadata } from "next";
import { ORDER_NUMBER_RE } from "@/lib/orders/number";
import { StatusLookup } from "./StatusLookup";

export const metadata: Metadata = { title: "Order status", alternates: { canonical: "/status" } };

export default async function StatusPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const prefill = ORDER_NUMBER_RE.test(order ?? "") ? order!.toUpperCase() : "";
  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Order status</h1>
      <p className="mt-2 text-muted">Enter your order number and the email you used. Both are in your receipt email.</p>
      <StatusLookup prefill={prefill} />
    </div>
  );
}
