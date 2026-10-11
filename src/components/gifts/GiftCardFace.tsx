import { cn } from "@/lib/cn";
import type { GiftDesign } from "@/lib/giftcards/designs";

/** Small six-armed snowflake for the holiday card. */
export function Flake({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="-12 -12 24 24" className={className} style={style} aria-hidden>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M0-10V10M-8.7-5 8.7 5M-8.7 5 8.7-5" />
      </g>
    </svg>
  );
}

/** Two holly leaves and three berries. */
export function Holly({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden>
      <path d="M30 26C22 14 10 12 2 16c6 2 6 8 2 12 8-2 14 2 16 8 2-6 6-8 10-10z" fill="#2f7d4a" />
      <path d="M34 26c8-12 20-14 28-10-6 2-6 8-2 12-8-2-14 2-16 8-2-6-6-8-10-10z" fill="#246b3d" />
      <circle cx="28" cy="28" r="6" fill="#e23b32" />
      <circle cx="38" cy="30" r="6" fill="#e23b32" />
      <circle cx="33" cy="20" r="6" fill="#ff5a4e" />
    </svg>
  );
}

/**
 * The front of a gift card in its design (navy, or red for the holidays), as HTML (the email uses a matching
 * picture from card-image.tsx). Shows the number and PIN when given.
 */
export function GiftCardFace({
  design,
  amount,
  to,
  from,
  number,
  pin,
  className,
}: {
  design: GiftDesign;
  /** Already formatted, like "$55.00". */
  amount: React.ReactNode;
  to?: string;
  from?: string;
  number?: string;
  pin?: string;
  className?: string;
}) {
  const holiday = design === "holiday";
  return (
    <div className={cn("relative aspect-[1.586] w-full overflow-hidden rounded-3xl p-[6%] text-left text-white shadow-[var(--shadow)]", className)} style={{ background: holiday ? "#a51d1d" : "#0e4471" }}>
      {holiday && (
        <>
          <Holly className="absolute right-[5%] top-[6%] w-[18%]" />
          {[
            [72, 38, 4.5],
            [66, 55, 3],
            [84, 50, 3.5],
            [91, 35, 2.5],
            [79, 30, 2.2],
          ].map(([x, y, s], i) => (
            <Flake key={i} className="absolute text-white/35" style={{ left: `${x}%`, top: `${y}%`, width: `${s}%` }} />
          ))}
        </>
      )}

      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lettering/coastline-prints-white.png" alt="Coastline Prints" className="h-[1.25em] w-auto sm:h-[1.5em]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={holiday ? "/brand/lettering/gift-card-gold.png" : "/brand/lettering/gift-card-blue.png"} alt="Gift Card" className="mt-[0.6em] h-[2.5em] w-auto sm:h-[3em]" />
      </div>

      <div className="absolute inset-x-[6%] bottom-[7%] flex items-end justify-between gap-4">
        <div className="min-w-0 text-[0.8em] sm:text-[0.85em]">
          {number ? (
            <>
              <p className="text-[0.75em] uppercase tracking-widest text-white/60">Card number</p>
              <p className="whitespace-nowrap font-mono font-semibold tracking-wide">{number}</p>
              <p className="mt-1 text-[0.75em] uppercase tracking-widest text-white/60">PIN</p>
              <p className="font-mono font-semibold tracking-wider">{pin}</p>
            </>
          ) : (
            <>
              <p className="truncate text-white/70">{to ? `For ${to}` : "For someone special"}</p>
              <p className="truncate text-white/70">{from ? `From ${from}` : ""}</p>
            </>
          )}
        </div>
        <div className="shrink-0 font-display text-[1.9em] font-bold text-[#e9c46a] sm:text-4xl">
          {amount}
        </div>
      </div>
    </div>
  );
}
