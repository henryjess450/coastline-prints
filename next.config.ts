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
  // Keep native modules out of the server bundle.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  experimental: {
    // The persistent dev cache writes large files to .next; off to save disk.
    turbopackFileSystemCacheForDev: false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
