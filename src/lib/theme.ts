/** The light or dark choice, kept in a cookie so the server renders it directly (no flash). */
export const THEME_COOKIE = "theme";
export const THEME_COOKIE_OPTIONS = { path: "/", maxAge: 31_536_000, sameSite: "lax" as const };
