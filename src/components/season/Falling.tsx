"use client";
import type { Falling as Kind } from "@config/seasons";

/**
 * Holiday decor drifting across the whole page: snow, leaves, hearts and so
 * on. Pure CSS animation (cheap, and it keeps going smoothly), never in the
 * way of a tap, a few less on phones, and gone for anyone who prefers reduced
 * motion. Each piece starts off screen and ends off screen, so loops never jump.
 */
export function Falling({ kind }: { kind: Kind }) {
  const spec = SPECS[kind];
  // A fixed pseudo-random pattern, so the server and browser draw the same thing.
  const rand = mulberry(kind.length * 7919);
  const pieces = Array.from({ length: spec.count }, (_, i) => {
    const size = spec.size[0] + rand() * (spec.size[1] - spec.size[0]);
    return {
      i,
      left: rand() * 100,
      size,
      duration: spec.speed[0] + rand() * (spec.speed[1] - spec.speed[0]),
      delay: -rand() * spec.speed[1],
      drift: (rand() - 0.5) * 30,
      spin: (rand() - 0.5) * 720,
      sway: 10 + rand() * 30,
      top: 8 + rand() * 60,
      variant: Math.floor(rand() * 6),
      opacity: spec.opacity[0] + rand() * (spec.opacity[1] - spec.opacity[0]),
    };
  });

  return (
    <div className="season-layer pointer-events-none fixed inset-0 z-[35] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.i}
          className={`season-piece season-${spec.motion}`}
          style={
            {
              left: spec.motion === "fly" ? undefined : `${p.left}%`,
              top: spec.motion === "fly" ? `${p.top}%` : undefined,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              "--drift": `${p.drift}vw`,
              "--spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        >
          <span className="season-sway" style={{ "--sway": `${p.sway}px`, animationDuration: `${3 + (p.i % 4)}s` } as React.CSSProperties}>
            {spec.draw(p.variant, p.size)}
          </span>
        </span>
      ))}
    </div>
  );
}

type Spec = { count: number; size: [number, number]; speed: [number, number]; opacity: [number, number]; motion: "fall" | "rise" | "fly"; draw: (variant: number, size: number) => React.ReactNode };

const svg = (children: React.ReactNode, viewBox = "0 0 24 24") => (
  <svg viewBox={viewBox} width="100%" height="100%">
    {children}
  </svg>
);

const SPECS: Record<Kind, Spec> = {
  snow: { count: 34, size: [4, 11], speed: [11, 22], opacity: [0.45, 0.9], motion: "fall", draw: () => svg(<circle cx="12" cy="12" r="12" fill="#ffffff" />) },
  confetti: {
    count: 30,
    size: [6, 11],
    speed: [8, 15],
    opacity: [0.7, 1],
    motion: "fall",
    draw: (v) => svg(<rect x="4" y="8" width="16" height="8" rx="1.5" fill={["#e9c46a", "#f5e6b8", "#c9a227", "#ffffff", "#e9c46a", "#d4af37"][v]} />),
  },
  hearts: {
    count: 16,
    size: [12, 24],
    speed: [14, 24],
    opacity: [0.5, 0.85],
    motion: "rise",
    draw: (v) => svg(<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill={["#ec4899", "#f472b6", "#e11d48", "#fb7185", "#f9a8d4", "#be185d"][v]} />),
  },
  eggs: {
    count: 14,
    size: [14, 24],
    speed: [14, 24],
    opacity: [0.75, 1],
    motion: "fall",
    draw: (v) => {
      const [a, b] = [["#c4b5fd", "#fde68a"], ["#a7f3d0", "#f9a8d4"], ["#fbcfe8", "#bfdbfe"], ["#fde68a", "#c4b5fd"], ["#bfdbfe", "#a7f3d0"], ["#fecaca", "#fef08a"]][v];
      return svg(
        <>
          <ellipse cx="12" cy="13" rx="8" ry="10.5" fill={a} />
          <path d="M4.3 12c2.5-2 5-2 7.7 0s5.2 2 7.7 0" stroke={b} strokeWidth="2.4" fill="none" />
          <path d="M5 16.5c2.3 1.5 4.6 1.5 7 0s4.7-1.5 7 0" stroke="#ffffff" strokeWidth="1.6" fill="none" opacity="0.8" />
        </>,
      );
    },
  },
  shamrocks: {
    count: 16,
    size: [14, 24],
    speed: [12, 22],
    opacity: [0.6, 0.95],
    motion: "fall",
    draw: (v) =>
      svg(
        <g fill={["#16a34a", "#22c55e", "#15803d", "#4ade80", "#16a34a", "#166534"][v]}>
          <circle cx="8" cy="9" r="4.2" />
          <circle cx="16" cy="9" r="4.2" />
          <circle cx="12" cy="15" r="4.2" />
          <path d="M12 15 L13.5 23" stroke="#166534" strokeWidth="1.8" />
        </g>,
      ),
  },
  maple: {
    count: 16,
    size: [14, 26],
    speed: [12, 22],
    opacity: [0.65, 0.95],
    motion: "fall",
    draw: (v) => svg(<path d={MAPLE} fill={["#dc2626", "#ef4444", "#b91c1c", "#dc2626", "#f87171", "#c8102e"][v]} />),
  },
  leaves: {
    count: 18,
    size: [14, 26],
    speed: [12, 22],
    opacity: [0.65, 0.95],
    motion: "fall",
    draw: (v) => svg(<path d={MAPLE} fill={["#c2410c", "#ea580c", "#b45309", "#d97706", "#92400e", "#a16207"][v]} />),
  },
  bats: {
    count: 6,
    size: [26, 44],
    speed: [16, 28],
    opacity: [0.7, 0.95],
    motion: "fly",
    draw: () =>
      svg(<path d="M2 10c2.5-1 4.5 0 5.5 2 .8-1.5 2.2-2.3 3.2-2.3l1.3-2 1.3 2c1 0 2.4.8 3.2 2.3 1-2 3-3 5.5-2-1.5 1.2-2 3-1.8 4.8-1.6-1.2-3.4-1.2-4.6.2-.8-.9-2-1.4-3.6-1.4s-2.8.5-3.6 1.4c-1.2-1.4-3-1.4-4.6-.2C4 13 3.5 11.2 2 10z" fill="var(--season-ink)" />),
  },
  balloons: {
    count: 10,
    size: [26, 40],
    speed: [16, 26],
    opacity: [0.8, 1],
    motion: "rise",
    draw: (v) =>
      svg(
        <>
          <ellipse cx="12" cy="9" rx="7" ry="8.5" fill={["#ec4899", "#3b82f6", "#facc15", "#22c55e", "#a855f7", "#f97316"][v]} />
          <path d="M11 17.3h2l-1 1.5z" fill={["#ec4899", "#3b82f6", "#facc15", "#22c55e", "#a855f7", "#f97316"][v]} />
          <path d="M12 18.8c-1 1.5 1 2.8 0 5.2" stroke="#94a3b8" strokeWidth="0.8" fill="none" />
          <ellipse cx="9.5" cy="6" rx="1.6" ry="2.4" fill="#ffffff" opacity="0.5" />
        </>,
        "0 0 24 26",
      ),
  },
};

const MAPLE =
  "M12 1.5l1.6 3.6 2.3-1-.6 4.5 3.5-2.8.5 2.2 3.2-.4-1.6 3.4 1.6 1-5 3.8.7 2-4.6-.8.2 5h-1.6l.2-5-4.6.8.7-2-5-3.8 1.6-1L1.5 9.6l3.2.4.5-2.2 3.5 2.8-.6-4.5 2.3 1z";

/** Small, seeded random numbers: the same sequence every time for the same seed. */
function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
