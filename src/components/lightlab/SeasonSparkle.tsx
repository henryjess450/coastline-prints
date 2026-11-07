/**
 * A little holiday magic over a product photo while its holiday is the site
 * theme. Christmas gets a string of fairy lights along the top and a few
 * flakes of snow; other holidays get twinkling stars in the theme colour.
 * Every loop starts and ends the same (flakes fade out before they wrap,
 * bulbs and stars breathe 1 → dim → 1), so nothing ever snaps. Never in the
 * way of a tap, and still for anyone who prefers reduced motion.
 */
export function SeasonSparkle({ seasonId }: { seasonId: string }) {
  return (
    <div className="sparkle-layer pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {seasonId === "christmas" ? (
        <>
          <FairyLights />
          {FLAKES.map((f, i) => (
            <span key={i} className="sparkle-flake" style={{ left: `${f.x}%`, width: f.size, height: f.size, animationDuration: `${f.dur}s`, animationDelay: `${-f.delay}s`, "--drift": `${f.drift}px` } as React.CSSProperties} />
          ))}
        </>
      ) : (
        STARS.map((s, i) => (
          <svg key={i} viewBox="0 0 24 24" className="sparkle-star text-accent-text" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, animationDelay: `${-s.delay}s` }}>
            <path d="M12 0c.6 6.6 5.4 11.4 12 12-6.6.6-11.4 5.4-12 12-.6-6.6-5.4-11.4-12-12C6.6 11.4 11.4 6.6 12 0z" fill="currentColor" />
          </svg>
        ))
      )}
    </div>
  );
}

/** A fixed pattern so the server and browser draw the same thing. */
const FLAKES = [
  { x: 8, size: 5, dur: 7, delay: 0.5, drift: 10 },
  { x: 22, size: 3, dur: 9, delay: 4, drift: -8 },
  { x: 37, size: 4, dur: 8, delay: 2, drift: 12 },
  { x: 53, size: 6, dur: 10, delay: 6, drift: -6 },
  { x: 68, size: 3, dur: 7.5, delay: 3, drift: 8 },
  { x: 81, size: 5, dur: 9.5, delay: 1, drift: -10 },
  { x: 93, size: 4, dur: 8.5, delay: 5, drift: 6 },
];

const STARS = [
  { x: 12, y: 18, size: 14, delay: 0 },
  { x: 78, y: 12, size: 10, delay: 0.8 },
  { x: 86, y: 62, size: 16, delay: 1.6 },
  { x: 20, y: 74, size: 9, delay: 2.2 },
];

const BULBS = ["#e63946", "#2a9d5c", "#f4c542", "#3a86ff", "#e63946", "#2a9d5c", "#f4c542", "#3a86ff", "#e63946"];

/** A drooping wire across the top with coloured bulbs that twinkle out of step. */
function FairyLights() {
  const n = BULBS.length;
  // The wire sags in three swags; each bulb hangs from it.
  const sag = (x: number) => 6 + 7 * Math.abs(Math.sin((x / 100) * Math.PI * 3));
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[14%] w-full">
      <path d={`M0 6 Q16.7 20 33.3 6 T66.7 6 T100 6`} fill="none" stroke="rgb(30 30 30 / 0.55)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      {BULBS.map((c, i) => {
        const x = ((i + 0.5) / n) * 100;
        return <ellipse key={i} cx={x} cy={sag(x) + 2.5} rx="1.6" ry="2.6" fill={c} className="sparkle-bulb" style={{ animationDelay: `${-(i * 0.37) % 1.8}s`, filter: `drop-shadow(0 0 2px ${c})` }} />;
      })}
    </svg>
  );
}
