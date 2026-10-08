"use client";
import { useState } from "react";
import { EtransferWaiting } from "@/components/checkout/EtransferWaiting";

export function EtransferPreview() {
  const [expiresAt] = useState(() => new Date(Date.now() + 2 * 3600_000).toISOString());
  return <EtransferWaiting details={{ attemptId: "00000000-0000-0000-0000-000000000000", code: "PAY-7K4QX", amountCents: 2451, sendTo: "sales@henryjess.ca", expiresAt }} onPaid={() => undefined} />;
}
