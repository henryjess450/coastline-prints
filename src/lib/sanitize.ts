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
  // The extension follows what the file really is (the fallback's), not what it was called.
  const ext = fallback.match(/\.\w+$/)?.[0] ?? ".stl";
  return `${cleaned.replace(/\.(stl|3mf)$/i, "") || "model"}${ext}`;
}
