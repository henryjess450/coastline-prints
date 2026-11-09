/**
 * Home-screen manifest for a single tablet screen (/pos, /kiosk). The site-wide
 * manifest starts at "/", so without its own one an iPad's "Add to Home Screen"
 * on these pages opens the Coastline home page instead of the screen.
 */
export function tabletManifest(path: string, name: string, shortName: string): Response {
  const body = {
    name,
    short_name: shortName,
    id: path,
    start_url: path,
    scope: path,
    display: "standalone",
    background_color: "#0a1520",
    theme_color: "#0a1520",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/manifest+json" } });
}
