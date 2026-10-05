/** Makes an uploaded filename safe to store and display. */
export function sanitizeFilename(name: string, fallback = "model.stl") {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  if (!cleaned) return fallback;
  return /\.stl$/i.test(cleaned) ? cleaned : `${cleaned}.stl`;
}
