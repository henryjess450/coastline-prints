import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

/** Link previews (iMessage, Facebook, Discord...) are 1200 × 630. */
export const SHARE_SIZE = { width: 1200, height: 630 };

const W = SHARE_SIZE.width;
const H = SHARE_SIZE.height;
const SKY = "#0a1520";
const SAND = "#e9c46a";
const LIGHT = "#86bbea";

let assets: { wordmark: string; heading: Buffer } | null = null;
function load() {
  // Read once; runtime paths, so the bundler doesn't trace the whole project.
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd());
  assets ??= {
    wordmark: `data:image/png;base64,${readFileSync(path.join(root, "public/brand/wordmark-white.png")).toString("base64")}`,
    heading: readFileSync(path.join(root, "assets/fonts/montserrat-latin-600-normal.woff")),
  };
  return assets;
}

/** A wavy-topped band of water across the card, from `base` down to the bottom. */
function band(base: number, amp: number, period: number, phase: number) {
  let d = `M0 ${H} L0 ${base}`;
  for (let x = 0; x <= W; x += 10) d += ` L${x} ${(base + amp * Math.sin(((x + phase) / period) * Math.PI * 2)).toFixed(1)}`;
  return `${d} L${W} ${H} Z`;
}

/**
 * The picture that shows when a link is shared, kept simple: the logo and one
 * big line in the night sky, with the sun setting over the waves below.
 */
export function shareCard({ title }: { title: string }) {
  const { wordmark, heading } = load();

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: SKY, position: "relative", fontFamily: "Montserrat" }}>
        {/* Sky, sun and sea: one drawing behind everything */}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
          <circle cx="1040" cy="430" r="52" fill={SAND} />
          <path d={band(478, 12, 300, 40)} fill="#2a5f8f" />
          <path d={band(500, 13, 340, 180)} fill="#174a77" />
          <path d={band(565, 11, 280, 90)} fill="#133f67" />
          <path d={band(604, 8, 360, 250)} fill="#0d2b49" />
        </svg>

        {/* The logo, and one big centred line */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", left: 0, right: 0, top: 54 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="84" height="84" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="15" fill="#0e4471" stroke="#2a5f8f" strokeWidth="0.8" />
              <path d="M5 17c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0 2.2 2 2.2 2" stroke="#ffffff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
              <path d="M7 22.5c1.8-1.5 3.6-1.5 5.4 0s3.6 1.5 5.4 0 3.6-1.5 5.4 0" stroke={LIGHT} strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <circle cx="21.5" cy="10" r="3" fill={SAND} />
            </svg>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wordmark} width={153} height={90} alt="" style={{ marginLeft: 16 }} />
          </div>
          <div style={{ display: "flex", marginTop: 40, maxWidth: 1000, textAlign: "center", justifyContent: "center", fontSize: 76, fontWeight: 600, lineHeight: 1.08, color: "#ffffff", letterSpacing: -1.5 }}>{title}</div>
        </div>
      </div>
    ),
    { ...SHARE_SIZE, fonts: [{ name: "Montserrat", data: heading, weight: 600, style: "normal" }] },
  );
}
