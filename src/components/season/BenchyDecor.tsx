import type { SeasonId } from "@config/seasons";
import type { BenchyColors } from "@/components/brand/Benchy";

/**
 * Holiday touches for the Benchy, drawn in its own coordinates (bow faces
 * right, waterline at y = 0, cabin roof at y = -104, chimney top at y = -128),
 * so they bob and tilt with the boat. Draw it right after <Benchy />.
 */
export function BenchyDecor({ season }: { season: SeasonId }) {
  switch (season) {
    case "christmas":
      return (
        <g>
          {/* Candy-cane stripes on the white deck rail */}
          <path d="M-72 -25 Q-10 -27 46 -47 Q64 -53 70 -44" fill="none" stroke="#c8102e" strokeWidth="7" strokeDasharray="7 7" />
          {/* Wreath above the cabin door, with a red bow */}
          <circle cx="0" cy="-80" r="10" fill="none" stroke="#1f7a3a" strokeWidth="6" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <circle key={a} cx={10 * Math.cos((a * Math.PI) / 180)} cy={-80 + 10 * Math.sin((a * Math.PI) / 180)} r="1.8" fill="#e11d2e" />
          ))}
          <path d="M0 -70 l-6 -4 v8 z M0 -70 l6 -4 v8 z" fill="#c8102e" />
          {/* A Santa hat on the chimney */}
          <path d="M-26 -126 Q-18 -150 2 -146 L-2 -138 Q-10 -140 -4 -126 Z" fill="#c8102e" />
          <rect x="-28" y="-130" width="26" height="7" rx="3.5" fill="#ffffff" />
          <circle cx="3" cy="-146" r="4" fill="#ffffff" />
        </g>
      );
    case "halloween":
      return <Pumpkin x={50} y={-58} face scale={1.35} />;
    case "thanksgiving":
      return (
        <g>
          <Pumpkin x={50} y={-58} scale={1.3} />
          <path d="M-56 -40 l3 -7 3 3 1 -6 3 5 3 -2 -1 6 -12 1 z" fill="#c2410c" />
        </g>
      );
    case "valentines":
      return (
        <g>
          {/* A heart above the cabin door, and a heart balloon tied to the stern */}
          <path d="M0 -70 C-14 -79 -12 -93 -4 -91 C-2 -90.5 -0.6 -89 0 -87.5 C0.6 -89 2 -90.5 4 -91 C12 -93 14 -79 0 -70 Z" fill="#ec4899" />
          <path d="M-60 -36 Q-70 -70 -64 -98" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
          <path d="M-64 -98 C-82 -110 -78 -128 -68 -126 C-66 -125.5 -64.8 -124 -64 -122 C-63.2 -124 -62 -125.5 -60 -126 C-50 -128 -46 -110 -64 -98 Z" fill="#e11d48" />
        </g>
      );
    case "easter":
      return (
        <g>
          {/* Eggs in a basket on the bow */}
          <g transform="translate(53 -52) scale(1.35) translate(-53 52)">
          <ellipse cx="44" cy="-58" rx="5" ry="7" fill="#c4b5fd" />
          <ellipse cx="54" cy="-60" rx="5" ry="7" fill="#fde68a" />
          <ellipse cx="62" cy="-57" rx="4.5" ry="6.5" fill="#a7f3d0" />
          <path d="M36 -56 H70 L66 -46 H40 Z" fill="#b45309" />
          <path d="M38 -56 Q53 -76 68 -56" fill="none" stroke="#b45309" strokeWidth="2.5" />
          </g>
        </g>
      );
    case "stpatricks":
      return (
        <g>
          <Pole x={-58} />
          <Flag x={-58} fill="#15803d">
            <g fill="#ffffff">
              <circle cx="-44" cy="-104" r="3" />
              <circle cx="-38" cy="-104" r="3" />
              <circle cx="-41" cy="-99" r="3" />
            </g>
          </Flag>
        </g>
      );
    case "canadaday":
      return (
        <g>
          <Pole x={-58} />
          <Flag x={-58} fill="#ffffff">
            <rect x="-57" y="-112" width="7" height="18" fill="#c8102e" />
            <rect x="-31" y="-112" width="7" height="18" fill="#c8102e" />
            <path d="M-40.5 -110 l1.5 3.5 2 -1 -.6 4.5 3 -2.4 .5 2 2.6 -.3 -1.3 2.8 1.3 .8 -4.2 3.2 .6 1.6 -3.8 -.6 .2 4h-1.6l.2 -4 -3.8 .6 .6 -1.6 -4.2 -3.2 1.3 -.8 -1.3 -2.8 2.6 .3 .5 -2 3 2.4 -.6 -4.5 2 1z" fill="#c8102e" />
          </Flag>
        </g>
      );
    case "remembrance":
      return (
        <g>
          {/* A poppy on the cabin, above the door */}
          {[
            [-5, -84],
            [5, -84],
            [-5, -76],
            [5, -76],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="6" fill="#dc2626" />
          ))}
          <circle cx="0" cy="-80" r="3.2" fill="#111111" />
        </g>
      );
    case "newyear":
      return <PartyHat />;
    case "birthday":
      return (
        <g>
          <PartyHat />
          {/* Balloons tied to the stern */}
          <path d="M-60 -36 Q-70 -70 -66 -104 M-60 -36 Q-52 -74 -48 -112" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
          <ellipse cx="-66" cy="-114" rx="10" ry="12" fill="#ec4899" />
          <ellipse cx="-47" cy="-122" rx="10" ry="12" fill="#facc15" />
        </g>
      );
    default:
      return null;
  }
}

function Pumpkin({ x, y, face, scale = 1 }: { x: number; y: number; face?: boolean; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="-6" cy="0" rx="8" ry="9" fill="#ea580c" />
      <ellipse cx="6" cy="0" rx="8" ry="9" fill="#ea580c" />
      <ellipse cx="0" cy="0" rx="7" ry="9.5" fill="#f97316" />
      <rect x="-1.5" y="-13" width="3" height="5" rx="1" fill="#3f6212" />
      {face && <path d="M-7 -3 l3 -3 2 3 z M7 -3 l-3 -3 -2 3 z M-7 3 q7 6 14 0 l-3 1 -2 -2 -2 2 -2 -2 -2 2 z" fill="#3b1d06" />}
    </g>
  );
}

const Pole = ({ x }: { x: number }) => <rect x={x - 1.5} y={-118} width={3} height={84} rx={1.5} fill="#cbd5e1" />;

/** A flag flying back towards the stern (the boat sails right, so the wind blows it left). */
function Flag({ x, fill, children }: { x: number; fill: string; children?: React.ReactNode }) {
  return (
    <g transform="translate(-36 0)">
      <rect x={x + 1} y={-112} width={34} height={18} fill={fill} stroke="#e2e8f0" strokeWidth="0.8" />
      {children}
    </g>
  );
}

/** A party hat on the chimney. */
function PartyHat() {
  return (
    <g>
      <path d="M-27 -126 L-14 -156 L-1 -126 Z" fill="#e9c46a" />
      <path d="M-22.5 -136 L-5.5 -136 M-19 -145 L-9 -145" stroke="#db2777" strokeWidth="3" />
      <circle cx="-14" cy="-157" r="4" fill="#db2777" />
    </g>
  );
}

/** Porthole emblems: a ring in the cabin colour with the holiday's symbol in it, centred on (44, -28). */
function Emblem({ ring, bg, children }: { ring: string; bg: string; children: React.ReactNode }) {
  return (
    <g>
      <circle cx="44" cy="-28" r="11" fill={bg} stroke={ring} strokeWidth="3.5" />
      <g transform="translate(44 -28)">{children}</g>
    </g>
  );
}

const heart = "M0 7 C-10 0 -9 -9 -3.5 -7.5 C-1.8 -7 -0.6 -5.8 0 -4.5 C0.6 -5.8 1.8 -7 3.5 -7.5 C9 -9 10 0 0 7 Z";
const maple = "M0 -8 l1.2 2.7 1.7 -.8 -.5 3.4 2.6 -2.1 .4 1.6 2.4 -.3 -1.2 2.5 1.2 .8 -3.7 2.8 .5 1.5 -3.4 -.6 .2 3.7h-1.2l.2 -3.7 -3.4 .6 .5 -1.5 -3.7 -2.8 1.2 -.8 -1.2 -2.5 2.4 .3 .4 -1.6 2.6 2.1 -.5 -3.4 1.7 .8z";

/**
 * The Benchy's holiday look: its colours, and what replaces the round window
 * on the bow. Blue (and anything not listed) keeps the normal Benchy.
 */
export function benchyLook(season: SeasonId): { colors?: BenchyColors; porthole?: React.ReactNode } {
  switch (season) {
    case "christmas":
      return {
        colors: { hull: "#c8102e", hullDark: "#7f1d1d", cabin: "#f1f5f9", cabinDark: "#15803d", rail: "#ffffff" },
        porthole: (
          <Emblem ring="#f1f5f9" bg="#15803d">
            <path d="M0 -7 l2 4.5 5 .5 -3.8 3.3 1.2 4.9 -4.4 -2.6 -4.4 2.6 1.2 -4.9 -3.8 -3.3 5 -.5z" fill="#facc15" />
          </Emblem>
        ),
      };
    case "halloween":
      return {
        colors: { hull: "#6d28d9", hullDark: "#3b0764", cabin: "#fb923c", cabinDark: "#431407", rail: "#fdba74" },
        porthole: (
          <Emblem ring="#fb923c" bg="#1c1917">
            {/* A spider web */}
            <g stroke="#e5e7eb" strokeWidth="0.9" fill="none">
              <path d="M-9 0 H9 M0 -9 V9 M-6.4 -6.4 L6.4 6.4 M-6.4 6.4 L6.4 -6.4" />
              <circle r="3.5" />
              <circle r="7" />
            </g>
            <circle cx="2.5" cy="2.5" r="2" fill="#f97316" />
          </Emblem>
        ),
      };
    case "valentines":
      return {
        colors: { hull: "#db2777", hullDark: "#9d174d", cabin: "#fbcfe8", cabinDark: "#be185d", rail: "#fdf2f8" },
        porthole: (
          <Emblem ring="#fbcfe8" bg="#ffffff">
            <path d={heart} fill="#e11d48" />
          </Emblem>
        ),
      };
    case "easter":
      return {
        colors: { hull: "#8b5cf6", hullDark: "#5b21b6", cabin: "#fef3c7", cabinDark: "#f9a8d4", rail: "#a7f3d0" },
        porthole: (
          <Emblem ring="#fef3c7" bg="#a7f3d0">
            <ellipse rx="5.5" ry="7.5" fill="#fde68a" />
            <path d="M-5.4 -1 q2.7 -2 5.4 0 t5.4 0" stroke="#ec4899" strokeWidth="1.6" fill="none" />
            <path d="M-5 3 q2.5 1.6 5 0 t5 0" stroke="#8b5cf6" strokeWidth="1.4" fill="none" />
          </Emblem>
        ),
      };
    case "stpatricks":
      return {
        colors: { hull: "#16a34a", hullDark: "#14532d", cabin: "#dcfce7", cabinDark: "#15803d", rail: "#facc15" },
        porthole: (
          <Emblem ring="#dcfce7" bg="#facc15">
            <g fill="#15803d">
              <circle cx="-3" cy="-3" r="3.3" />
              <circle cx="3" cy="-3" r="3.3" />
              <circle cx="0" cy="2.4" r="3.3" />
              <path d="M0 2 L1.5 8" stroke="#15803d" strokeWidth="1.6" />
            </g>
          </Emblem>
        ),
      };
    case "canadaday":
      return {
        colors: { hull: "#dc2626", hullDark: "#7f1d1d", cabin: "#ffffff", cabinDark: "#dc2626", rail: "#ffffff" },
        porthole: (
          <Emblem ring="#ffffff" bg="#ffffff">
            <path d={maple} fill="#dc2626" transform="scale(1.05)" />
          </Emblem>
        ),
      };
    case "thanksgiving":
      return {
        colors: { hull: "#b45309", hullDark: "#78350f", cabin: "#fde68a", cabinDark: "#c2410c", rail: "#fbbf24" },
        porthole: (
          <Emblem ring="#fde68a" bg="#fff7ed">
            <path d={maple} fill="#ea580c" transform="scale(1.05)" />
          </Emblem>
        ),
      };
    case "remembrance":
      return {
        porthole: (
          <Emblem ring="#86bbea" bg="#ffffff">
            <g fill="#dc2626">
              <circle cx="-3" cy="-3" r="4" />
              <circle cx="3" cy="-3" r="4" />
              <circle cx="-3" cy="3" r="4" />
              <circle cx="3" cy="3" r="4" />
            </g>
            <circle r="2.2" fill="#111111" />
          </Emblem>
        ),
      };
    case "newyear":
      return {
        colors: { hull: "#94a3b8", hullDark: "#475569", cabin: "#e9c46a", cabinDark: "#1e293b", rail: "#facc15" },
        porthole: (
          <Emblem ring="#e9c46a" bg="#0f172a">
            {/* A clock at midnight */}
            <circle r="7" fill="#fef3c7" />
            <path d="M0 0 V-5.5 M0 0 V-4" stroke="#0f172a" strokeWidth="1.6" strokeLinecap="round" />
          </Emblem>
        ),
      };
    case "birthday":
      return {
        colors: { hull: "#ec4899", hullDark: "#9d174d", cabin: "#fde68a", cabinDark: "#3b82f6", rail: "#a7f3d0" },
        porthole: (
          <Emblem ring="#fde68a" bg="#ffffff">
            {/* A little cake with a candle */}
            <rect x="-6" y="-1" width="12" height="7" rx="1.5" fill="#f9a8d4" />
            <path d="M-6 1 q1.5 2 3 0 t3 0 t3 0 t3 0" stroke="#ffffff" strokeWidth="1.2" fill="none" />
            <rect x="-0.8" y="-6" width="1.6" height="5" fill="#3b82f6" />
            <path d="M0 -9.5 q1.6 2 0 3 q-1.6 -1 0 -3z" fill="#f97316" />
          </Emblem>
        ),
      };
    default:
      return {};
  }
}

