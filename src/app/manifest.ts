import type { MetadataRoute } from "next";
import { site } from "@config/site";

/** Makes the site installable as an app on Android and iPhone (opens full screen, own icon). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: "Coastline",
    description: "Upload an STL, see your price, and pick up your 3D print. Gift cards and your saved coupons in one place.",
    id: "/",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#0a1520",
    theme_color: "#0a1520",
    categories: ["shopping", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Start an order", url: "/order", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Your account", url: "/account", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Gift cards", url: "/gift-cards", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
