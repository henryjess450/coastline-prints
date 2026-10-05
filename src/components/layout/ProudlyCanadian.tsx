/**
 * A little flagpole rising from the bottom edge of the page with a waving
 * Canadian flag. The wave is the flag cut into thin vertical strips, each
 * bobbing a moment after the one before. Reduced motion holds it still.
 */
const W = 60;
const H = 30;
const STRIPS = 15;
const RED = "#d52b1e";

// A simple, symmetric maple leaf in a 100 × 100 box.
const LEAF =
  "50,5 55,17 62,13 60,32 72,22 74,28 86,26 82,38 90,42 70,58 73,66 53,63 52,92 48,92 47,63 27,66 30,58 10,42 18,38 14,26 26,28 28,22 40,32 38,13 45,17";

export function ProudlyCanadian() {
  const strip = W / STRIPS;
  return (
    <div className="flex items-start justify-center gap-3">
      <svg width={W + 8} height={H + 52} viewBox={`-4 -6 ${W + 8} ${H + 52}`} className="block shrink-0 overflow-visible" aria-hidden>
        <defs>
          <g id="ca-flag">
            <rect width={W} height={H} fill="#ffffff" />
            <rect width={W / 4} height={H} fill={RED} />
            <rect x={(W * 3) / 4} width={W / 4} height={H} fill={RED} />
            <polygon points={LEAF} fill={RED} transform={`translate(${W / 4 + 3} 3) scale(0.24)`} />
          </g>
          {Array.from({ length: STRIPS }, (_, i) => (
            <clipPath key={i} id={`ca-strip-${i}`}>
              {/* A hair wider than the strip so no seams show while waving */}
              <rect x={i * strip - 0.3} y={-4} width={strip + 0.6} height={H + 8} />
            </clipPath>
          ))}
        </defs>
        {/* Pole, running down to the bottom edge */}
        <rect x={-2.5} y={-3} width={2.5} height={H + 52} rx={1.2} fill="var(--border-strong)" />
        <circle cx={-1.25} cy={-4} r={2.4} fill="var(--sand)" />
        {Array.from({ length: STRIPS }, (_, i) => (
          <g key={i} clipPath={`url(#ca-strip-${i})`}>
            <g className="flag-strip" style={{ animationDelay: `${-i * 0.09}s`, ["--lift" as string]: `${0.6 + (i / STRIPS) * 2.6}px` }}>
              <use href="#ca-flag" />
              {/* Soft fold shading on every other strip */}
              {i % 2 === 1 && <rect x={i * strip} width={strip} height={H} fill="#000000" opacity={0.05} />}
            </g>
          </g>
        ))}
      </svg>
      <span className="pt-2 text-base font-semibold text-muted sm:text-lg">Canadian Owned &amp; Operated</span>
    </div>
  );
}
