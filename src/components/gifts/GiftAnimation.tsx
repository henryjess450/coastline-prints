"use client";
/**
 * The gift card send-off: the little card (in its design) drops into the box,
 * then the shared scene takes over. A holiday card ends with the delivery
 * truck and the living room instead of the Benchy.
 */
import { HOLIDAY_FINALE_MS, HolidayFinale } from "@/components/holiday/HolidayScenes";
import { GOLD, SendOff, type PayResult } from "@/components/sendoff/SendOff";
import type { GiftDesign } from "@/lib/giftcards/designs";

export type { PayResult };


export function GiftAnimation({ result, amount, design = "coastline", onDone }: { result: PayResult; amount: string; design?: GiftDesign; onDone: () => void }) {
  const holiday = design === "holiday";
  return (
    <SendOff
      result={result}
      label={holiday ? "Delivering your gift" : "Sending your gift"}
      contents={<GiftCard amount={amount} design={design} />}
      finale={holiday ? (viewBox, className) => <HolidayFinale viewBox={viewBox} className={className} /> : undefined}
      sailMs={holiday ? HOLIDAY_FINALE_MS : undefined}
      onDone={onDone}
    />
  );
}

function GiftCard({ amount, design }: { amount: string; design: GiftDesign }) {
  const holiday = design === "holiday";
  return (
    <g>
      <rect x="246" y="212" width="108" height="68" rx="9" fill={holiday ? "#a51d1d" : "#0e4471"} />
      <path d="M256 248c4-3.5 8-3.5 12 0s8 3.5 12 0 8-3.5 12 0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="282" cy="230" r="4" fill={holiday ? "#2f9a58" : GOLD} />
      <text x="344" y="272" textAnchor="end" fontSize="15" fontWeight="700" fill={GOLD} fontFamily="var(--font-geist-sans)">
        {amount}
      </text>
    </g>
  );
}
