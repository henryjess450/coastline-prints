/*
 * The order lamp's animations, for the dashboard preview. A line-for-line
 * copy of firmware/lamp/anims.py (which is what the lamp itself runs):
 * change one, change the other.
 *
 * Each frame function takes t (seconds since the animation started) and v
 * (the sale in dollars, only Payment uses it) and returns 12 colours. LED 0 is the bottom of the ring; height(i) counts up
 * both sides to the top (LED 6). Every animation starts and ends dark.
 */

export type Rgb = readonly [number, number, number];

export const N = 12;

const OFF: Rgb = [0, 0, 0];
const DEEP: Rgb = [11, 34, 58];
const NAVY: Rgb = [14, 68, 113];
const SEA: Rgb = [42, 95, 143];
const WAKE: Rgb = [134, 187, 234];
const FOAM: Rgb = [79, 179, 169];
const WHITE: Rgb = [255, 255, 255];
const LAMP: Rgb = [255, 236, 190];
const SAND: Rgb = [233, 196, 106];
const CORAL: Rgb = [231, 111, 81];

const clamp = (x: number, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
const ease = (x: number) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const add = (a: Rgb, b: Rgb, t = 1): Rgb => [a[0] + b[0] * t, a[1] + b[1] * t, a[2] + b[2] * t];
const scale = (a: Rgb, t: number): Rgb => [a[0] * t, a[1] * t, a[2] * t];
const height = (i: number) => Math.min(i, N - i);
const around = (i: number, p: number) => {
  const k = (((i - p) % N) + N) % N;
  return Math.min(k, N - k);
};
const env = (t: number, d: number, fade = 0.8) => ease(t / fade) * ease((d - t) / fade);
const hash01 = (n: number) => (Math.imul(n, 2654435761) >>> 0) / 4294967296;
const leds = (f: (i: number) => Rgb) => Array.from({ length: N }, (_, i) => f(i));

function tide(t: number) {
  return leds((i) => {
    const d = height(i);
    const body = mix(NAVY, SEA, d / 6);
    if (t < 1.6) {
      const lvl = ease(t / 1.6) * 7;
      const c = scale(body, clamp(lvl - d));
      return mix(c, WAKE, clamp(1 - Math.abs(lvl - 1 - d)) * 0.7 * (1 - (t / 1.6) ** 2));
    }
    if (t < 4.6) {
      const u = t - 1.6;
      const amp = ease(u / 0.4) * ease((3 - u) / 0.4);
      const k = around(i, (u / 3) * 24);
      const c = mix(body, FOAM, clamp(1 - k / 3) * 0.5 * amp);
      return mix(c, WHITE, clamp(1 - k / 1.4) ** 2 * amp);
    }
    return scale(body, clamp(7 * (1 - ease((t - 4.6) / 1.4)) - d));
  });
}

const RIPPLES = [
  [0.15, 1.0],
  [1.35, 0.6],
  [2.55, 0.35],
] as const;

function ripple(t: number) {
  const bg = ease(t / 0.5) * ease((4.5 - t) / 1.2) * 0.45;
  return leds((i) => {
    const d = height(i);
    let c = scale(NAVY, bg);
    if (i === 0) c = add(c, WHITE, clamp(1 - Math.abs(t - 0.12) / 0.12));
    for (const [t0, s] of RIPPLES) {
      const f = (t - t0) * 5;
      if (f < 0 || f > 9) continue;
      c = add(c, WAKE, clamp(1 - Math.abs(d - f) / 1.1) * s);
      if (d < f) c = add(c, FOAM, clamp(1 - (f - d) / 2.5) * s * 0.5);
      if (i === N / 2) c = add(c, WHITE, clamp(1 - Math.abs(f - 6.5)) * s);
    }
    return c;
  });
}

function lighthouse(t: number) {
  const e = env(t, 6.5);
  const p = (t / 6.5) * 36;
  return leds((i) => {
    const beam = clamp(1 - around(i, p) / 2.2) ** 2 + 0.3 * clamp(1 - around(i, p + 6) / 2.2) ** 2;
    return add(scale(mix(DEEP, NAVY, 0.6), e), LAMP, beam * e);
  });
}

function sunset(t: number) {
  return leds((i) => {
    const d = height(i);
    if (t < 2) return scale(SAND, clamp(ease(t / 2) * 7 - d));
    if (t < 5) {
      const k = clamp(((t - 2) / 3) * 1.8 - ((6 - d) / 6) * 0.8);
      return k < 0.5 ? mix(SAND, CORAL, k * 2) : mix(CORAL, NAVY, k * 2 - 1);
    }
    let c = scale(NAVY, clamp(7 * (1 - ease((t - 5) / 2)) - d));
    if (i === 5 || i === 8) c = add(c, WHITE, Math.sin((Math.PI * (t - 5)) / 2) ** 2 * 0.6);
    return c;
  });
}

function treasure(t: number) {
  const e = env(t, 4.0, 0.5);
  return leds((i) => {
    const s = Math.sin(2 * Math.PI * (t * (0.8 + 1.4 * hash01(i + 1)) + hash01(i + 50)));
    const tw = s > 0 ? s ** 6 : 0;
    const c = add(scale(NAVY, 0.5 * e), SAND, tw * e);
    return add(c, WHITE, clamp((tw - 0.8) / 0.2) * 0.6 * e);
  });
}

function swell(t: number) {
  const e = env(t, 6.0);
  return leds((i) => {
    const v = 0.5 + 0.5 * Math.sin(2 * Math.PI * ((i / N) * 2 - t * 0.6));
    return scale(mix(mix(DEEP, SEA, v), WAKE, clamp((v - 0.85) / 0.15)), e);
  });
}

const GREEN: Rgb = [60, 210, 110];
const LAPS = [GREEN, SAND, WAKE, WHITE];
const MAX_DOLLARS = 48;

function paymentSteps(v: number) {
  const n = Math.max(1, Math.min(MAX_DOLLARS, Math.trunc(v)));
  return [n, Math.min(0.15, 3.0 / n)] as const;
}

function paymentSeconds(v: number) {
  const [n, step] = paymentSteps(v);
  return 1.3 + n * step + 3.1;
}

function payment(t: number, v = 1) {
  const [n, step] = paymentSteps(v);
  const d = paymentSeconds(v);
  if (t < 1.2) return leds(() => scale(GREEN, Math.sin((Math.PI * t) / 1.2) ** 2));
  const fade = ease((d - t) / 0.6);
  return leds((i) => {
    let c = OFF;
    for (let k = i + 1; k <= n; k += N) {
      const tk = 1.3 + (k - 1) * step;
      if (t < tk) break;
      c = mix(LAPS[Math.floor((k - 1) / N)], WHITE, clamp(1 - (t - tk) / 0.25) * 0.6);
    }
    return scale(c, fade);
  });
}

function bubbles(t: number) {
  const bg = env(t, 5.2, 0.5) * 0.35;
  return leds((i) => {
    const d = height(i);
    let c = scale(NAVY, bg);
    for (let j = 0; j < 8; j++) {
      const h = ((t - j * 0.45) / 1.4) * 6.5;
      if (h < -1 || h > 7) continue;
      if (i === 0 || i === N / 2 || i < N / 2 === (j % 2 === 0)) c = add(c, FOAM, clamp(1 - Math.abs(d - h) / 0.8) * clamp(h / 0.8) * 0.8);
      if (i === N / 2) c = add(c, WHITE, clamp(1 - Math.abs(h - 6.3) / 0.5) * 0.8);
    }
    return c;
  });
}

function starlight(t: number) {
  const e = env(t, 6.0);
  return leds((i) => {
    const start = hash01(i + 7) * 3.8;
    const dur = 1.2 + hash01(i + 30);
    let c = add(scale(DEEP, e), WHITE, Math.sin(Math.PI * clamp((t - start) / dur)) ** 2 * 0.55);
    if (t >= 2.6 && t <= 3.9) {
      const p = 2.5 + ((t - 2.6) / 0.8) * 7;
      const behind = (((p - i) % N) + N) % N;
      const glow = behind < 3 ? (1 - behind / 3) ** 2 : clamp(1 - (N - behind) / 0.6);
      c = add(c, WHITE, glow * clamp((t - 2.6) / 0.15) * clamp((3.9 - t) / 0.5));
    }
    return c;
  });
}

/** The idle glow ("Calm sea"). Loops forever. */
export function calmSea(t: number) {
  return leds((i) => scale(mix(DEEP, NAVY, 0.5 + 0.5 * Math.sin(2 * Math.PI * (i / N - t / 8))), 0.5));
}

export const dark = (): Rgb[] => leds(() => OFF);

export const LAMP_ANIMS = {
  tide: { name: "Tide", blurb: "The sea rises up the ring, a crest of foam laps it twice, then the tide goes out.", seconds: 6, frame: tide },
  ripple: { name: "Ripple", blurb: "A drop lands at the bottom and ripples run up both sides, splashing at the top.", seconds: 4.5, frame: ripple },
  lighthouse: { name: "Lighthouse", blurb: "A warm beam sweeps round a dark sea three times.", seconds: 6.5, frame: lighthouse },
  sunset: { name: "Sunset", blurb: "The sun fills the ring with gold, sets through coral into navy, and two stars come out.", seconds: 7, frame: sunset },
  treasure: { name: "Treasure", blurb: "Gold glints over the sea, each light at its own pace.", seconds: 4, frame: treasure },
  swell: { name: "Swell", blurb: "Rolling bands of sea go round with pale crests.", seconds: 6, frame: swell },
  payment: {
    name: "Payment",
    blurb: "A green pulse, then one light per dollar. Past $12 it goes round again in gold, then blue, then white.",
    seconds: paymentSeconds,
    frame: payment,
  },
  bubbles: { name: "Bubbles", blurb: "Seafoam bubbles rise up both sides and pop at the top.", seconds: 5.2, frame: bubbles },
  starlight: { name: "Starlight", blurb: "Stars fade in and out over a night sea, and a shooting star goes over.", seconds: 6, frame: starlight },
} satisfies Record<string, { name: string; blurb: string; seconds: number | ((v: number) => number); frame: (t: number, v: number) => Rgb[] }>;

/** How long an animation runs. Payment's length depends on the dollars. */
export const animSeconds = (id: LampAnim, v = 0) => {
  const s = LAMP_ANIMS[id].seconds;
  return typeof s === "function" ? s(v) : s;
};

export type LampAnim = keyof typeof LAMP_ANIMS;
export const LAMP_ANIM_IDS = Object.keys(LAMP_ANIMS) as LampAnim[];
