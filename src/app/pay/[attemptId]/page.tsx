import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { etransferSettings } from "@/lib/payments/etransfer.server";
import { PayWaiting } from "./PayWaiting";

export const metadata: Metadata = { title: "Waiting for your e-Transfer", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Linked from the "how to pay" email: the e-Transfer details and live status. */
export default async function PayPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();
  const co = await db.checkout.findUnique({ where: { idempotencyKey: attemptId }, include: { order: true } });
  if (!co || co.paymentMethod !== "ETRANSFER" || !co.etransferCode) notFound();
  if (co.order) redirect(`/orders/${co.order.viewToken}`);
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <PayWaiting
        details={{ attemptId, code: co.etransferCode, amountCents: co.totalCents, sendTo: etransferSettings()?.email ?? "", expiresAt: co.expiresAt?.toISOString() ?? null }}
        expired={co.status === "FAILED"}
      />
    </div>
  );
}
