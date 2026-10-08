import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  // The public site is always served over HTTPS (Caddy handles the certificate).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Load these from node_modules at runtime instead of bundling them: native
  // modules, and the e-Transfer mail libraries (big, and bundling them made
  // the Docker build run out of memory).
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3", "imapflow", "mailparser", "mailauth"],
  experimental: {
    // The persistent dev cache writes large files to .next; off to save disk.
    turbopackFileSystemCacheForDev: false,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must never be cached, so app updates reach phones straight away.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
