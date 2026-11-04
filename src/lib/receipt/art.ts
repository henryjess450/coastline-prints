import type { SeasonId } from "@config/seasons";
import { LAMPS } from "@/components/lightlab/hero/lamp-lines";
import type { MarketArt } from "./themes";

/**
 * Line drawings for the stand's receipts, as SVG for a 576-dot-wide thermal
 * printer: black lines and solid black shapes only (no greys, no gradients),
 * strokes thick enough to survive the print head. Each returns its SVG and
 * height, or null when there's nothing to draw.
 */

export type Art = { svg: string; h: number };
const W = 576;
const svg = (h: number, body: string): Art => ({
  h,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}"><g fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`,
});
export const artUri = (a: Art) => `data:image/svg+xml;base64,${Buffer.from(a.svg).toString("base64")}`;

/** Repeatable "random" numbers, so a receipt always draws the same. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const f = (n: number) => n.toFixed(1);

// ── Little shapes ────────────────────────────────────────────────────────

function snowflake(x: number, y: number, r: number) {
  let d = "";
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    d += `M${f(x - dx)} ${f(y - dy)}L${f(x + dx)} ${f(y + dy)}`;
    // Little V on each arm end.
    for (const s of [1, -1]) {
      const ex = x + s * dx * 0.62, ey = y + s * dy * 0.62;
      const b = r * 0.3;
      for (const t of [0.6, -0.6]) d += `M${f(ex)} ${f(ey)}l${f(Math.cos(a + (s > 0 ? Math.PI : 0) + t) * -b)} ${f(Math.sin(a + (s > 0 ? Math.PI : 0) + t) * -b)}`;
    }
  }
  return `<path d="${d}" stroke-width="2.5"/>`;
}

/** Heart centred on x,y, `s` wide. */
function heart(x: number, y: number, s: number, filled = false) {
  const k = s / 20;
  const d = `M${f(x)} ${f(y + 8 * k)}C${f(x - 2 * k)} ${f(y + 5 * k)} ${f(x - 10 * k)} ${f(y)} ${f(x - 10 * k)} ${f(y - 4 * k)}C${f(x - 10 * k)} ${f(y - 9 * k)} ${f(x - 3 * k)} ${f(y - 11 * k)} ${f(x)} ${f(y - 5 * k)}C${f(x + 3 * k)} ${f(y - 11 * k)} ${f(x + 10 * k)} ${f(y - 9 * k)} ${f(x + 10 * k)} ${f(y - 4 * k)}C${f(x + 10 * k)} ${f(y)} ${f(x + 2 * k)} ${f(y + 5 * k)} ${f(x)} ${f(y + 8 * k)}Z`;
  return `<path d="${d}"${filled ? ' fill="#000"' : ""}/>`;
}

function star(x: number, y: number, r: number, filled = true) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return `${f(x + Math.cos(a) * rr)},${f(y + Math.sin(a) * rr)}`;
  }).join(" ");
  return `<polygon points="${pts}"${filled ? ' fill="#000"' : ""}/>`;
}

/** A string of lights in swags across the width, bulbs hanging from it. */
function lightString(y: number, swags: number, dip: number, bulbsPerSwag: number) {
  const span = W / swags;
  let wire = `M0 ${y}`;
  let bulbs = "";
  for (let i = 0; i < swags; i++) {
    const x0 = i * span;
    wire += `Q${f(x0 + span / 2)} ${f(y + dip * 2)} ${f(x0 + span)} ${y}`;
    for (let j = 1; j <= bulbsPerSwag; j++) {
      const t = j / (bulbsPerSwag + 1);
      const bx = x0 + span * t;
      const by = y + 2 * dip * 2 * t * (1 - t);
      const n = i * bulbsPerSwag + j;
      bulbs += `<rect x="${f(bx - 3.5)}" y="${f(by)}" width="7" height="6" fill="#000" stroke-width="1.5"/>`;
      bulbs += `<path d="M${f(bx)} ${f(by + 5)}c-7 5 -7 15 0 19c7 -4 7 -14 0 -19z"${n % 2 ? ' fill="#000"' : ""} stroke-width="2.5"/>`;
    }
  }
  return `<path d="${wire}" stroke-width="2.5"/>${bulbs}`;
}

function pine(x: number, base: number, h: number, topStar = false) {
  const trunk = h * 0.12;
  let d = "";
  // Three overlapping tiers, each wider and lower than the last.
  for (let i = 0; i < 3; i++) {
    const top = base - h + i * h * 0.24;
    const bottom = base - trunk - (2 - i) * h * 0.2;
    const half = h * (0.2 + i * 0.1);
    d += `M${f(x)} ${f(top)}L${f(x - half)} ${f(bottom)}Q${f(x)} ${f(bottom + 6)} ${f(x + half)} ${f(bottom)}Z`;
  }
  d += `M${f(x - 6)} ${f(base - trunk)}v${f(trunk)}M${f(x + 6)} ${f(base - trunk)}v${f(trunk)}`;
  return `<path d="${d}" fill="#fff"/>${topStar ? star(x, base - h - 6, 12) : ""}`;
}

function gift(x: number, base: number, w: number, h: number) {
  return `<rect x="${x}" y="${base - h}" width="${w}" height="${h}"/><path d="M${x + w / 2} ${base - h}v${h}M${x} ${base - h * 0.55}h${w}"/><path d="M${x + w / 2} ${base - h}c-10 -10 -16 -2 -8 2zM${x + w / 2} ${base - h}c10 -10 16 -2 8 2z" stroke-width="2.5"/>`;
}

/** Simple maple leaf, ~`s` across. */
function maple(x: number, y: number, s: number, filled = true) {
  const k = s / 40;
  const pts = [
    [0, -20], [4, -11], [9, -13], [7, -3], [15, -9], [14, -4], [20, -5], [16, 3], [18, 5], [8, 9], [9, 13], [1, 11], [1, 20], [-1, 20], [-1, 11], [-9, 13], [-8, 9], [-18, 5], [-16, 3], [-20, -5], [-14, -4], [-15, -9], [-7, -3], [-9, -13], [-4, -11],
  ]
    .map(([a, b]) => `${f(x + a * k)},${f(y + b * k)}`)
    .join(" ");
  return `<polygon points="${pts}"${filled ? ' fill="#000"' : ""} stroke-width="2"/>`;
}

function leaf(x: number, y: number, s: number, angle: number, filled = false) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})"><path d="M0 0C${f(s * 0.4)} ${f(-s * 0.35)} ${f(s * 0.85)} ${f(-s * 0.2)} ${f(s)} 0C${f(s * 0.85)} ${f(s * 0.2)} ${f(s * 0.4)} ${f(s * 0.35)} 0 0Z"${filled ? ' fill="#000"' : ""} stroke-width="2.5"/><path d="M0 0L${f(s * 0.8)} 0" stroke-width="1.5"${filled ? ' stroke="#fff"' : ""}/></g>`;
}

function shamrock(x: number, y: number, s: number) {
  const k = s / 30;
  let out = "";
  for (const a of [-90, 30, 150]) out += `<g transform="translate(${f(x)} ${f(y)}) rotate(${a + 90})">${heart(0, -9 * k, 18 * k, true)}</g>`;
  return out + `<path d="M${f(x)} ${f(y)}q${f(3 * k)} ${f(10 * k)} ${f(8 * k)} ${f(16 * k)}" stroke-width="3"/>`;
}

function egg(x: number, base: number, w: number, h: number, pattern: number) {
  const top = base - h;
  const body = `M${f(x)} ${f(base)}C${f(x - w * 0.55)} ${f(base)} ${f(x - w * 0.5)} ${f(top + h * 0.15)} ${f(x)} ${f(top)}C${f(x + w * 0.5)} ${f(top + h * 0.15)} ${f(x + w * 0.55)} ${f(base)} ${f(x)} ${f(base)}Z`;
  const yy = top + h * 0.5;
  let deco = "";
  if (pattern === 0) {
    deco = `<path d="M${f(x - w * 0.47)} ${f(yy)}${Array.from({ length: 6 }, (_, i) => `l${f(w / 6.4)} ${i % 2 ? 7 : -7}`).join("")}" stroke-width="2.5"/>`;
  } else if (pattern === 1) {
    deco = [-0.22, 0, 0.22].map((t) => `<circle cx="${f(x + w * t)}" cy="${f(yy)}" r="3.5" fill="#000" stroke="none"/>`).join("") + `<path d="M${f(x - w * 0.42)} ${f(yy - 12)}h${f(w * 0.84)}M${f(x - w * 0.44)} ${f(yy + 12)}h${f(w * 0.88)}" stroke-width="2"/>`;
  } else {
    deco = `<path d="M${f(x - w * 0.36)} ${f(top + h * 0.28)}h${f(w * 0.72)}M${f(x - w * 0.47)} ${f(top + h * 0.62)}h${f(w * 0.94)}" stroke-width="5"/>`;
  }
  return `<path d="${body}"/>${deco}`;
}

function pumpkin(x: number, base: number, w: number, face: boolean) {
  const h = w * 0.78;
  const cy = base - h / 2;
  const body = `<ellipse cx="${f(x)}" cy="${f(cy)}" rx="${f(w / 2)}" ry="${f(h / 2)}" fill="#000"/>`;
  const ribs = `<path d="M${f(x - w * 0.18)} ${f(base - h + 6)}C${f(x - w * 0.3)} ${f(cy)} ${f(x - w * 0.3)} ${f(cy + h * 0.3)} ${f(x - w * 0.16)} ${f(base - 4)}M${f(x + w * 0.18)} ${f(base - h + 6)}C${f(x + w * 0.3)} ${f(cy)} ${f(x + w * 0.3)} ${f(cy + h * 0.3)} ${f(x + w * 0.16)} ${f(base - 4)}" stroke="#fff" stroke-width="2"/>`;
  const stem = `<path d="M${f(x)} ${f(base - h + 2)}q2 -12 9 -14" stroke-width="5"/>`;
  const faceSvg = face
    ? `<polygon points="${f(x - w * 0.24)},${f(cy - 4)} ${f(x - w * 0.12)},${f(cy - 18)} ${f(x - w * 0.02)},${f(cy - 4)}" fill="#fff" stroke="none"/><polygon points="${f(x + w * 0.02)},${f(cy - 4)} ${f(x + w * 0.12)},${f(cy - 18)} ${f(x + w * 0.24)},${f(cy - 4)}" fill="#fff" stroke="none"/><path d="M${f(x - w * 0.28)} ${f(cy + 6)}q${f(w * 0.28)} ${f(h * 0.32)} ${f(w * 0.56)} 0l-8 5l-7 -6l-8 7l-7 -7l-8 7l-7 -7l-8 6z" fill="#fff" stroke="none"/>`
    : "";
  return body + ribs + stem + faceSvg;
}

function bat(x: number, y: number, s: number) {
  const k = s / 40;
  const p = (pts: number[][]) => pts.map(([a, b], i) => `${i ? "L" : "M"}${f(x + a * k)} ${f(y + b * k)}`).join("");
  return `<path d="${p([[0, -4], [3, -9], [4, -3], [10, -6], [20, -10], [17, -3], [20, 3], [13, 1], [10, 6], [6, 2], [0, 7], [-6, 2], [-10, 6], [-13, 1], [-20, 3], [-17, -3], [-20, -10], [-10, -6], [-4, -3], [-3, -9]])}Z" fill="#000" stroke-width="1.5"/>`;
}

function balloon(x: number, y: number, r: number, filled: boolean, string: number) {
  return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r * 1.2)}"${filled ? ' fill="#000"' : ""}/><path d="M${f(x - 4)} ${f(y + r * 1.2 + 5)}l4 -5l4 5z" fill="#000" stroke-width="1.5"/><path d="M${f(x)} ${f(y + r * 1.2 + 5)}c-8 ${f(string * 0.3)} 8 ${f(string * 0.6)} 0 ${f(string)}" stroke-width="2"/>`;
}

function bunting(y: number, flags: number, dip: number) {
  const span = W / 2;
  const d = `M0 ${y}Q${span / 2} ${y + dip * 2} ${span} ${y}Q${span * 1.5} ${y + dip * 2} ${W} ${y}`;
  let tri = "";
  for (let i = 0; i < flags; i++) {
    const x = ((i + 0.5) * W) / flags;
    const local = (x % span) / span;
    const yy = y + 2 * dip * 2 * local * (1 - local);
    tri += `<polygon points="${f(x - 13)},${f(yy)} ${f(x + 13)},${f(yy)} ${f(x)},${f(yy + 28)}"${i % 2 ? "" : ' fill="#000"'} stroke-width="2.5"/>`;
  }
  return `<path d="${d}" stroke-width="2.5"/>${tri}`;
}

function poppy(x: number, y: number, r: number) {
  let petals = "";
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    petals += `<circle cx="${f(x + Math.cos(a) * r * 0.5)}" cy="${f(y + Math.sin(a) * r * 0.5)}" r="${f(r * 0.62)}" fill="#000" stroke="#fff" stroke-width="2"/>`;
  }
  return `${petals}<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.24)}" fill="#fff" stroke="none"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.13)}" fill="#000" stroke="none"/>`;
}

function flower(x: number, y: number, r: number, petals: number, filled: boolean) {
  let p = "";
  for (let i = 0; i < petals; i++) {
    const a = (i * 360) / petals;
    p += `<ellipse cx="0" cy="${f(-r * 0.62)}" rx="${f(r * 0.3)}" ry="${f(r * 0.48)}" transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"${filled ? ' fill="#000"' : ""} stroke-width="2.5"/>`;
  }
  return `${p}<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.22)}" fill="${filled ? "#fff" : "#000"}" stroke-width="2.5"/>`;
}

function confetti(top: number, h: number, n: number, seed: number) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = 10 + r() * (W - 20), y = top + r() * h, kind = Math.floor(r() * 3), a = r() * 180;
    if (kind === 0) out += `<rect x="-6" y="-2.5" width="12" height="5" fill="#000" stroke="none" transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"/>`;
    else if (kind === 1) out += `<circle cx="${f(x)}" cy="${f(y)}" r="3.5" fill="#000" stroke="none"/>`;
    else out += `<circle cx="${f(x)}" cy="${f(y)}" r="4" stroke-width="2"/>`;
  }
  return out;
}

// ── Seasons: a strip along the top and a little scene at the bottom ─────

export function seasonTop(id: SeasonId): Art | null {
  switch (id) {
    case "christmas":
      return svg(62, lightString(6, 4, 9, 3));
    case "newyear":
      return svg(60, confetti(6, 48, 34, 7) + star(60, 30, 9, false) + star(510, 24, 11, false));
    case "valentines":
      return svg(40, Array.from({ length: 12 }, (_, i) => heart(24 + i * 48, 20, 24, i % 2 === 0)).join(""));
    case "stpatricks":
      return svg(56, Array.from({ length: 7 }, (_, i) => shamrock(40 + i * 82, 22, 30)).join(""));
    case "easter":
      return svg(56, Array.from({ length: 8 }, (_, i) => egg(36 + i * 72, 50, 34, 44, i % 3)).join(""));
    case "canadaday":
      return svg(46, bunting(4, 14, 7));
    case "thanksgiving": {
      let vine = `<path d="M0 22C96 4 192 40 288 22S480 4 576 22" stroke-width="2.5"/>`;
      for (let i = 0; i < 11; i++) vine += i % 3 === 1 ? maple(26 + i * 52, 26 + (i % 2 ? 6 : -4), 30, i % 2 === 0) : leaf(26 + i * 52, 22, 28, i % 2 ? 40 : -40, i % 2 === 0);
      return svg(52, vine);
    }
    case "halloween":
      return svg(56, bat(70, 22, 46) + bat(170, 36, 30) + bat(420, 18, 34) + bat(510, 34, 48) + `<path d="M260 4c0 22 0 30 0 34" stroke-width="1.5"/><path d="M260 38c-8 -2 -12 6 -8 10M260 38c8 -2 12 6 8 10M252 44h16M253 49l-6 4M267 49l6 4" stroke-width="2"/><circle cx="260" cy="44" r="7" fill="#000"/>`);
    case "birthday":
      return svg(46, bunting(4, 14, 7));
    default:
      return null;
  }
}

export function seasonBottom(id: SeasonId): Art | null {
  const ground = (y: number) => `<path d="M8 ${y}H568" stroke-width="3"/>`;
  switch (id) {
    case "christmas": {
      // Snowflakes in the gaps between the trees.
      const flakes = [[36, 34, 12], [76, 92, 9], [214, 36, 10], [232, 96, 8], [356, 28, 11], [500, 40, 12], [540, 100, 9], [470, 14, 7]].map(([x, y, r]) => snowflake(x, y, r)).join("");
      return svg(160, flakes + pine(150, 150, 96) + pine(288, 150, 120, true) + pine(426, 150, 90) + gift(198, 150, 40, 30) + gift(340, 150, 34, 24) + gift(372, 150, 26, 36) + ground(150));
    }
    case "newyear":
      return svg(130, `<g transform="rotate(-14 260 110)"><path d="M232 30h40c0 34 -8 46 -20 48c-12 -2 -20 -14 -20 -48z"/><path d="M252 78v32M238 112h28"/><path d="M236 46h32" stroke-width="2"/></g><g transform="rotate(14 316 110)"><path d="M296 30h40c0 34 -8 46 -20 48c-12 -2 -20 -14 -20 -48z"/><path d="M316 78v32M302 112h28"/><path d="M300 46h32" stroke-width="2"/></g>` + star(288, 14, 10) + `<path d="M268 18l-12 -10M308 18l12 -10M288 0v-2" stroke-width="2.5"/>` + confetti(10, 110, 14, 3));
    case "valentines":
      return svg(110, heart(288, 56, 110) + heart(288, 54, 60, true) + heart(170, 70, 30) + heart(406, 70, 30) + heart(120, 40, 18, true) + heart(456, 40, 18, true));
    case "stpatricks":
      return svg(100, shamrock(288, 46, 64) + shamrock(190, 66, 30) + shamrock(386, 66, 30) + ground(96));
    case "easter":
      return svg(110, egg(220, 104, 58, 76, 0) + egg(288, 104, 64, 86, 1) + egg(356, 104, 58, 76, 2) + `<path d="M150 104c20 -14 30 -14 46 0M380 104c16 -14 26 -14 46 0" stroke-width="2.5"/>` + ground(104));
    case "canadaday":
      return svg(110, maple(288, 54, 96) + maple(170, 70, 34, false) + maple(406, 70, 34, false));
    case "thanksgiving":
      return svg(110, pumpkin(250, 104, 80, false) + pumpkin(334, 104, 58, false) + leaf(170, 94, 34, -20, true) + leaf(400, 96, 30, -160, false) + maple(420, 70, 28) + maple(150, 66, 26, false) + ground(104));
    case "halloween":
      return svg(120, `<circle cx="470" cy="34" r="26"/><circle cx="482" cy="28" r="24" fill="#fff" stroke="none"/>` + pumpkin(200, 114, 92, true) + pumpkin(320, 114, 70, true) + pumpkin(410, 114, 50, false) + ground(114));
    case "remembrance":
      return svg(84, poppy(288, 42, 34));
    case "birthday":
      return svg(150, balloon(200, 44, 26, true, 80) + balloon(262, 34, 30, false, 92) + balloon(330, 46, 26, true, 78) + balloon(388, 40, 22, false, 84) + confetti(4, 50, 10, 21));
    default:
      return null;
  }
}

// ── Markets: a band under the logo ───────────────────────────────────────

export function marketBand(art: MarketArt): Art | null {
  switch (art) {
    case "harbour": {
      const waves = [92, 108].map((y, j) => `<path d="M0 ${y}${Array.from({ length: 12 }, () => "q24 -10 48 0").join("")}" transform="translate(${j * 24} 0)" stroke-width="2.5"/>`).join("");
      const boat = `<path d="M90 86h96l-14 16h-68z" fill="#000"/><path d="M138 84V20M138 22l40 58h-40zM134 28l-36 52h36z"/>`;
      const light = `<path d="M452 92l8 -64h24l8 64z"/><path d="M455 70h34M458 48h28" stroke-width="2.5"/><rect x="458" y="12" width="28" height="16"/><path d="M464 12l8 -10l8 10"/><path d="M450 18l-40 -8M450 22l-40 8M494 18l40 -8M494 22l40 8" stroke-width="2"/>`;
      const gulls = `<path d="M280 32q8 -8 14 0q6 -8 14 0M330 50q6 -6 11 0q5 -6 11 0" stroke-width="2.5"/>`;
      return svg(116, waves + boat + light + gulls);
    }
    case "city": {
      const r = rng(5);
      let out = "";
      let x = 6;
      let i = 0;
      while (x < W - 40) {
        const w = 60 + Math.floor(r() * 30);
        const h = 54 + Math.floor(r() * 44);
        const top = 112 - h;
        const roof = i % 3 === 0 ? `<path d="M${x - 2} ${top}l${w / 2 + 2} -18l${w / 2 + 2} 18"/>` : i % 3 === 1 ? `<path d="M${x - 3} ${top}h${w + 6}M${x + 4} ${top - 6}h${w - 8}v6" stroke-width="2.5"/>` : `<path d="M${x} ${top}v-8h${w}v8" stroke-width="2.5"/>`;
        let windows = "";
        for (let wy = top + 10; wy < 74; wy += 20) for (let wx = x + 9; wx < x + w - 14; wx += 18) windows += `<rect x="${wx}" y="${wy}" width="9" height="12" stroke-width="2"/>`;
        const awning = `<path d="M${x + 4} 84h${w - 8}l-4 10h${-(w - 16)}z"${i % 2 ? ' fill="#000"' : ""} stroke-width="2.5"/><path d="M${x + w / 2 - 8} 112v-14h16v14" stroke-width="2.5"/>`;
        out += `<rect x="${x}" y="${top}" width="${w}" height="${h}"/>${roof}${windows}${awning}`;
        x += w + 6;
        i++;
      }
      return svg(116, out + `<path d="M0 113H576" stroke-width="3"/>`);
    }
    case "garden": {
      let out = `<path d="M0 108H576" stroke-width="3"/>`;
      const spots = [40, 110, 180, 250, 330, 400, 470, 540];
      spots.forEach((x, i) => {
        const top = 30 + (i % 3) * 14;
        out += `<path d="M${x} 108C${x - 4} 90 ${x + 4} 70 ${x} ${top + 12}" stroke-width="2.5"/>`;
        out += leaf(x, 84 - (i % 2) * 8, 22, i % 2 ? -30 : -150, i % 2 === 0);
        out += flower(x, top, 20 + (i % 2) * 4, i % 2 ? 6 : 5, i % 3 === 1);
      });
      return svg(114, out);
    }
    case "forest": {
      const mtn = `<path d="M0 96L90 30l40 30l70 -50l80 62l60 -36l90 58l70 -44l76 60" stroke-width="3"/><path d="M180 24l20 -14l18 14l-12 -2l-8 6l-8 -6z" fill="#000" stroke-width="1.5"/>`;
      const trees = [30, 76, 118, 400, 446, 492, 540].map((x, i) => pine(x, 112, 48 + (i % 3) * 14)).join("");
      return svg(116, mtn + trees + `<path d="M0 112H576" stroke-width="3"/>`);
    }
    case "lights": {
      const moon = `<circle cx="500" cy="64" r="26" fill="#000"/><circle cx="512" cy="56" r="24" fill="#fff" stroke="none"/>`;
      const stars = star(80, 78, 7) + star(170, 96, 5) + star(400, 92, 6) + star(300, 104, 4, false);
      return svg(114, lightString(4, 3, 12, 4) + moon + stars);
    }
    default:
      return null;
  }
}

// ── LightLab's own lamps, side by side, for the foot of the receipt ─────

export function lampRow(height = 92): Art {
  const gap = 34;
  const sized = LAMPS.map((l) => {
    const [x0, y0, w, h] = l.box;
    const k = height / h;
    return { l, k, x0, y0, w: w * k };
  });
  const total = sized.reduce((a, s) => a + s.w, 0) + gap * (sized.length - 1);
  let x = (W - total) / 2;
  let body = "";
  for (const s of sized) {
    const strokes = s.l.strokes.map((st) => ("dot" in st ? `<circle cx="${st.dot[0]}" cy="${st.dot[1]}" r="${st.dot[2]}" fill="#000" stroke="none"/>` : `<path d="${st.d}"/>`)).join("");
    body += `<g transform="translate(${f(x - s.x0 * s.k)} ${f(4 - s.y0 * s.k)}) scale(${s.k.toFixed(4)})" stroke-width="${(2.6 / s.k).toFixed(2)}">${strokes}</g>`;
    x += s.w + gap;
  }
  return svg(height + 8, body);
}
