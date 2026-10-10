/**
 * Site themes for holidays. Blue ("coastline") is the default; the owner
 * switches one on from Admin > Settings and it stays until they switch back.
 * Each theme can recolour the accent (buttons, links, highlights) and add
 * decor: things drifting down the page, and a little something on the logo.
 * Safe to import anywhere.
 */
export type SeasonId = "coastline" | "christmas" | "halloween" | "valentines" | "easter" | "stpatricks" | "canadaday" | "thanksgiving" | "remembrance" | "newyear" | "birthday";

/** What drifts across the page. */
export type Falling = "snow" | "bats" | "hearts" | "eggs" | "shamrocks" | "maple" | "leaves" | "confetti" | "balloons";
/** What sits on the logo. */
export type LogoTopper = "santa" | "witch" | "heart" | "bunny" | "shamrock" | "maple" | "poppy" | "party";
/** A string along the bottom of the header. */
export type HeaderTrim = "lights" | "bunting-red" | "bunting-party" | "garland-fall";

type Accent = { accent: string; text: string; line: string; soft: string };

export type Season = {
  id: SeasonId;
  name: string;
  /** One line for the admin picker. */
  blurb: string;
  /** Accent colours for dark and light mode; null keeps the brand blue. */
  colors: { dark: Accent; light: Accent } | null;
  falling: Falling | null;
  topper: LogoTopper | null;
  trim: HeaderTrim | null;
};

const accent = (accent: string, darkText: string, darkLine: string, rgb: string): { dark: Accent; light: Accent } => ({
  dark: { accent, text: darkText, line: darkLine, soft: `rgb(${rgb} / 0.4)` },
  light: { accent, text: accent, line: accent, soft: `rgb(${rgb} / 0.1)` },
});

export const seasons: Season[] = [
  { id: "coastline", name: "Coastline blue", blurb: "The everyday look.", colors: null, falling: null, topper: null, trim: null },
  { id: "christmas", name: "Christmas", blurb: "Snow, twinkling lights and a Santa hat.", colors: accent("#a4161a", "#f6a5a5", "#d64545", "164 22 26"), falling: "snow", topper: "santa", trim: "lights" },
  { id: "halloween", name: "Halloween", blurb: "Bats, orange and a witch's hat.", colors: accent("#c2410c", "#fdba74", "#ea7a35", "194 65 12"), falling: "bats", topper: "witch", trim: null },
  { id: "valentines", name: "Valentine's Day", blurb: "Floating hearts in pink.", colors: accent("#be185d", "#f9a8d4", "#e0569a", "190 24 93"), falling: "hearts", topper: "heart", trim: null },
  { id: "easter", name: "Easter", blurb: "Pastel eggs and bunny ears.", colors: accent("#6d4fc2", "#c9b8fb", "#9a7fe6", "109 79 194"), falling: "eggs", topper: "bunny", trim: null },
  { id: "stpatricks", name: "St. Patrick's Day", blurb: "Shamrocks and green.", colors: accent("#15803d", "#86efac", "#2fa75b", "21 128 61"), falling: "shamrocks", topper: "shamrock", trim: null },
  { id: "canadaday", name: "Canada Day", blurb: "Maple leaves and red bunting.", colors: accent("#c8102e", "#fca5a5", "#e04a5f", "200 16 46"), falling: "maple", topper: "maple", trim: "bunting-red" },
  { id: "thanksgiving", name: "Thanksgiving", blurb: "Autumn leaves and warm orange.", colors: accent("#9a3412", "#fdba74", "#c8662e", "154 52 18"), falling: "leaves", topper: null, trim: "garland-fall" },
  { id: "remembrance", name: "Remembrance Day", blurb: "A poppy on the logo. Nothing else.", colors: null, falling: null, topper: "poppy", trim: null },
  { id: "newyear", name: "New Year's", blurb: "Gold confetti.", colors: null, falling: "confetti", topper: "party", trim: null },
  { id: "birthday", name: "Shop birthday", blurb: "Balloons, confetti and party bunting.", colors: accent("#db2777", "#f9a8d4", "#ec5c9c", "219 39 119"), falling: "balloons", topper: "party", trim: "bunting-party" },
];

export const DEFAULT_SEASON: SeasonId = "coastline";

export function seasonById(id: string | null | undefined): Season {
  return seasons.find((s) => s.id === id) ?? seasons[0];
}

/** The theme's accent colours as CSS, or "" for the brand blue. */
export function seasonCss(s: Season) {
  if (!s.colors) return "";
  const vars = (a: Accent) => `--accent:${a.accent};--accent-text:${a.text};--accent-line:${a.line};--accent-soft:${a.soft};--ring:${a.text};`;
  return `:root{${vars(s.colors.dark)}}[data-theme="light"]{${vars(s.colors.light)}--ring:${s.colors.light.accent};}`;
}
