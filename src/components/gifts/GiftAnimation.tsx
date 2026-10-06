"use client";
/** The gift card send-off: the little navy card drops into the box, then the shared scene takes over. */
import { GOLD, SendOff, type PayResult } from "@/components/sendoff/SendOff";

export type { PayResult };

export function GiftAnimation({ result, amount, onDone }: { result: PayResult; amount: string; onDone: () => void }) {
  return <SendOff result={result} label="Sending your gift" contents={<GiftCard amount={amount} />} onDone={onDone} />;
}

function GiftCard({ amount }: { amount: string }) {
  return (
    <g>
      <rect x="246" y="212" width="108" height="68" rx="9" fill="#0e4471" />
      <path d="M256 248c4-3.5 8-3.5 12 0s8 3.5 12 0 8-3.5 12 0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="282" cy="230" r="4" fill={GOLD} />
      <text x="344" y="272" textAnchor="end" fontSize="15" fontWeight="700" fill={GOLD} fontFamily="var(--font-geist-sans)">
        {amount}
      </text>
    </g>
  );
}
