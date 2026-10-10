/**
 * The Benchy mascot and seagulls, shared by the home page and the order flow.
 * Solid brand colours only.
 */
const SAND = "#e9c46a";
const PALE = "#dfe8f1";
const HULL_BLUE = "#3d7bb8";
const HULL_NAVY = "#0e4471";
const CABIN_LIGHT = "#86bbea";
const CABIN_MID = "#4f91cc";

/** A seagull: two curved wings that beat up and down. flap runs from -1 to 1. */
export function Gull({ x, y, flap, size }: { x: number; y: number; flap: number; size: number }) {
  const tip = -10 * flap;
  const mid = -12 - 4 * flap;
  return (
    <path
      transform={`translate(${x} ${y}) scale(${size})`}
      d={`M-18 ${tip} Q-9 ${mid} 0 0 Q9 ${mid} 18 ${tip}`}
      fill="none"
      stroke="var(--muted)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** A bat, for Halloween: same idea as the gull, its scalloped wings beat up and down (flap from -1 to 1). */
export function Bat({ x, y, flap, size }: { x: number; y: number; flap: number; size: number }) {
  const tip = -9 * flap - 2;
  const mid = -8 - 5 * flap;
  const wing = (s: 1 | -1) =>
    `M${s * 2} -1 Q${s * 10} ${mid} ${s * 22} ${tip} Q${s * 19} ${tip + 6} ${s * 15} ${tip + 7} Q${s * 13} 2 ${s * 9} 3 Q${s * 6} 1 ${s * 2} 3 Z`;
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`} fill="var(--season-ink)">
      <path d={wing(-1)} />
      <path d={wing(1)} />
      <ellipse cx="0" cy="1" rx="3.6" ry="5" />
      <path d="M-3 -2.5 L-2.4 -7 L-0.8 -3.5 Z M3 -2.5 L2.4 -7 L0.8 -3.5 Z" />
    </g>
  );
}

/**
 * A friendly, rounded take on the 3DBenchy test print in the brand blues:
 * blue hull, light blue cabin with the arched doorway, a porthole and a chimney puffing smoke.
 * Bow faces right; the waterline is y = 0. Pass `time` (seconds) to puff smoke.
 */
export type BenchyColors = { hull: string; hullDark: string; cabin: string; cabinDark: string; rail?: string };

/**
 * `colors` repaints it (holiday themes); `porthole` draws something else
 * where the round window on the bow is, centred on (44, -28).
 */
export function Benchy({ time, colors, porthole }: { time?: number; colors?: BenchyColors; porthole?: React.ReactNode }) {
  const HULL = colors?.hull ?? HULL_BLUE;
  const HULL_DARK = colors?.hullDark ?? HULL_NAVY;
  const CABIN = colors?.cabin ?? CABIN_LIGHT;
  const CABIN_DARK = colors?.cabinDark ?? CABIN_MID;
  const RAIL = colors?.rail ?? CABIN;
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {/* Smoke puffs drift up from the chimney */}
      {time != null &&
        [0, 1, 2].map((i) => {
          const k = (time / 1.5 + i / 3) % 1;
          return <circle key={i} cx={-14 + k * 10} cy={-122 - k * 34} r={4 + k * 7} fill={PALE} opacity={0.8 * (1 - k)} />;
        })}
      {/* Chimney */}
      <rect x="-22" y="-124" width="16" height="30" rx="5" fill={CABIN} />
      <rect x="-25" y="-128" width="22" height="9" rx="4.5" fill={CABIN_DARK} />
      {/* Cabin */}
      <path d="M-30 -32 V-90 Q-30 -96 -24 -96 H24 Q30 -96 30 -90 V-40 Z" fill={CABIN} />
      <rect x="-36" y="-104" width="74" height="12" rx="6" fill={CABIN} />
      <path d="M-12 -36 V-66 A12 12 0 0 1 12 -66 V-39 Z" fill={CABIN_DARK} />
      {/* Stern box */}
      <rect x="-64" y="-36" width="18" height="12" rx="4" fill={CABIN} />
      {/* Hull */}
      <path d="M-70 -24 Q-10 -26 46 -46 Q66 -52 70 -42 Q66 -10 36 4 Q18 10 -40 10 Q-66 10 -70 -6 Z" fill={HULL} />
      <path d="M-70 -6 Q-66 10 -40 10 Q18 10 36 4 Q50 -3 58 -12 Q20 2 -40 2 Q-60 2 -70 -6 Z" fill={HULL_DARK} />
      {/* Light blue deck rail along the top of the hull */}
      <path d="M-72 -25 Q-10 -27 46 -47 Q64 -53 70 -44" fill="none" stroke={RAIL} strokeWidth="7" />
      {/* Porthole (or a holiday emblem in its place) */}
      {porthole ?? (
        <>
          <circle cx="44" cy="-28" r="7.5" fill={SAND} stroke={CABIN} strokeWidth="3.5" />
          <circle cx="42" cy="-30" r="2" fill="#ffffff" opacity="0.8" />
        </>
      )}
    </g>
  );
}

/** The Benchy on its own, as a small inline icon. Bow faces right. */
export function BenchyIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * 0.92} viewBox="-76 -132 152 146" className={className} aria-hidden>
      <Benchy />
    </svg>
  );
}
