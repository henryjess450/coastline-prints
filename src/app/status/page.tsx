import type { Metadata } from "next";
import { StatusLookup } from "./StatusLookup";

export const metadata: Metadata = { title: "Order status" };

export default async function StatusPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const prefill = /^CP-\d{4}-[A-Z0-9]{4}$/i.test(order ?? "") ? order!.toUpperCase() : "";
  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Order status</h1>
      <p className="mt-2 text-muted">Enter your order number and the email you used. Both are in your receipt email.</p>
      <StatusLookup prefill={prefill} />
    </div>
  );
}
