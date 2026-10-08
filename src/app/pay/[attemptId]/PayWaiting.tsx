"use client";
import { useRouter } from "next/navigation";
import { EtransferWaiting, type EtransferDetails } from "@/components/checkout/EtransferWaiting";

export function PayWaiting({ details, expired }: { details: EtransferDetails; expired: boolean }) {
  const router = useRouter();
  return (
    <EtransferWaiting
      details={expired ? { ...details, expiresAt: new Date(0).toISOString() } : details}
      onPaid={(viewToken) => {
        // Send the receipt now rather than after the send-off hold, then show the confirmation.
        void fetch("/api/sendoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: viewToken }), keepalive: true }).catch(() => undefined);
        router.push(`/orders/${viewToken}`);
      }}
    />
  );
}
