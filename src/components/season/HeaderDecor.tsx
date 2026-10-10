"use client";
import type { HeaderTrim, LogoTopper } from "@config/seasons";

/** A little something sitting on the logo's circle mark: a Santa hat, bunny ears, a poppy... */
export function Topper({ kind }: { kind: LogoTopper }) {
  const art = TOPPERS[kind];
  return (
    <span aria-hidden className="pointer-events-none absolute z-10" style={art.at}>
      <svg viewBox="0 0 32 32" width={art.size} height={art.size}>
        {art.svg}
      </svg>
    </span>
  );
}

const TOPPERS: Record<LogoTopper, { at: React.CSSProperties; size: number; svg: React.ReactNode }> = {
  santa: {
    at: { left: -9, top: -15, transform: "rotate(-22deg)" },
    size: 34,
    svg: (
      <>
        <path d="M5 23 C7 12 14 5 22 6 C26 7 27 12 28 16 L24 15 C22 11 19 11 17 13 C15 15 15 19 15 23 Z" fill="#c8102e" />
        <rect x="3" y="21" width="15" height="6" rx="3" fill="#ffffff" />
        <circle cx="27.5" cy="17.5" r="3.4" fill="#ffffff" />
      </>
    ),
  },
  witch: {
    at: { left: -8, top: -19, transform: "rotate(-16deg)" },
    size: 36,
    svg: (
      <>
        <path d="M8 22 L17 2 L22 12 L20 22 Z" fill="var(--season-ink)" />
        <rect x="9" y="17.5" width="12" height="3" fill="#f97316" />
        <ellipse cx="15" cy="23" rx="13" ry="3.2" fill="var(--season-ink)" />
      </>
    ),
  },
  heart: {
    at: { right: -6, top: -9 },
    size: 20,
    svg: <path d="M16 29s-12-7.6-12-16a6.5 6.5 0 0 1 12-3.6A6.5 6.5 0 0 1 28 13c0 8.4-12 16-12 16z" fill="#ec4899" stroke="#ffffff" strokeWidth="2" />,
  },
  bunny: {
    at: { left: 2, top: -20 },
    size: 32,
    svg: (
      <>
        <ellipse cx="10" cy="13" rx="4.2" ry="11" fill="#ffffff" transform="rotate(-12 10 13)" />
        <ellipse cx="10" cy="14" rx="2" ry="7.5" fill="#f9a8d4" transform="rotate(-12 10 14)" />
        <ellipse cx="22" cy="13" rx="4.2" ry="11" fill="#ffffff" transform="rotate(12 22 13)" />
        <ellipse cx="22" cy="14" rx="2" ry="7.5" fill="#f9a8d4" transform="rotate(12 22 14)" />
      </>
    ),
  },
  shamrock: {
    at: { right: -7, top: -10 },
    size: 22,
    svg: (
      <g fill="#16a34a" stroke="#ffffff" strokeWidth="1.2">
        <circle cx="11" cy="11" r="6" />
        <circle cx="21" cy="11" r="6" />
        <circle cx="16" cy="19" r="6" />
      </g>
    ),
  },
  maple: {
    at: { right: -8, top: -10 },
    size: 22,
    svg: <path d="M16 2l2.1 4.8 3-1.3-.8 6 4.6-3.7.7 2.9 4.3-.5-2.1 4.5 2.1 1.3-6.6 5 .9 2.7-6.1-1.1.3 6.6h-2.2l.3-6.6-6.1 1.1.9-2.7-6.6-5 2.1-1.3-2.1-4.5 4.3.5.7-2.9 4.6 3.7-.8-6 3 1.3z" fill="#c8102e" stroke="#ffffff" strokeWidth="1" />,
  },
  poppy: {
    at: { right: -7, top: -8 },
    size: 22,
    svg: (
      <>
        <g fill="#dc2626">
          <circle cx="11" cy="11" r="7" />
          <circle cx="21" cy="11" r="7" />
          <circle cx="11" cy="21" r="7" />
          <circle cx="21" cy="21" r="7" />
        </g>
        <circle cx="16" cy="16" r="4.2" fill="#111111" />
      </>
    ),
  },
  party: {
    at: { left: -4, top: -20, transform: "rotate(-14deg)" },
    size: 30,
    svg: (
      <>
        <path d="M6 26 L16 2 L26 26 Z" fill="#e9c46a" />
        <path d="M9.5 18 L22.5 18 M12.5 11 L19.5 11" stroke="#db2777" strokeWidth="2.5" />
        <circle cx="16" cy="3" r="3" fill="#db2777" />
      </>
    ),
  },
};

/** A string along the bottom of the header: twinkling lights, bunting, or a leaf garland. */
export function Trim({ kind }: { kind: HeaderTrim }) {
  const count = 60;
  return (
    <div aria-hidden className="season-trim pointer-events-none absolute inset-x-0 -bottom-3 z-10 flex h-5 justify-between overflow-hidden px-1">
      {/* The string itself */}
      <svg className="absolute inset-x-0 top-0 h-3 w-full" preserveAspectRatio="none" viewBox="0 0 100 10">
        <path d="M0 1 Q 1.25 6 2.5 1 T 5 1 T 7.5 1 T 10 1 T 12.5 1 T 15 1 T 17.5 1 T 20 1 T 22.5 1 T 25 1 T 27.5 1 T 30 1 T 32.5 1 T 35 1 T 37.5 1 T 40 1 T 42.5 1 T 45 1 T 47.5 1 T 50 1 T 52.5 1 T 55 1 T 57.5 1 T 60 1 T 62.5 1 T 65 1 T 67.5 1 T 70 1 T 72.5 1 T 75 1 T 77.5 1 T 80 1 T 82.5 1 T 85 1 T 87.5 1 T 90 1 T 92.5 1 T 95 1 T 97.5 1 T 100 1" stroke={kind === "garland-fall" ? "#78350f" : "#1f2937"} strokeWidth="0.35" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="relative mt-1 block w-8 shrink-0">
          {kind === "lights" ? (
            <span className="season-bulb mx-auto block h-3 w-2 rounded-b-full" style={{ background: ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#f97316"][i % 5], animationDelay: `${(i % 7) * 0.23}s`, boxShadow: `0 0 8px ${["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#f97316"][i % 5]}` }} />
          ) : kind === "garland-fall" ? (
            <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 25}deg)` }}>
              <path d="M12 1.5l1.6 3.6 2.3-1-.6 4.5 3.5-2.8.5 2.2 3.2-.4-1.6 3.4 1.6 1-5 3.8.7 2-4.6-.8.2 5h-1.6l.2-5-4.6.8.7-2-5-3.8 1.6-1L1.5 9.6l3.2.4.5-2.2 3.5 2.8-.6-4.5 2.3 1z" fill={["#c2410c", "#d97706", "#92400e"][i % 3]} />
            </svg>
          ) : (
            <svg viewBox="0 0 20 16" className="mx-auto h-3.5 w-4">
              <path d="M1 0 H19 L10 15 Z" fill={kind === "bunting-red" ? (i % 2 ? "#ffffff" : "#c8102e") : ["#ec4899", "#3b82f6", "#facc15", "#22c55e", "#a855f7"][i % 5]} />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}
