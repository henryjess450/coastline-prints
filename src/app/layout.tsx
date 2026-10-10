import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { seasonCss } from "@config/seasons";
import { site } from "@config/site";
import { getSeason } from "@/lib/season";
import { liveAnnouncement } from "@/lib/announcements";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Providers } from "@/components/layout/Providers";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import "./globals.css";

// Fonts are bundled in ./fonts so building never needs to download anything.
const geistSans = localFont({ src: "./fonts/Geist-Variable.woff2", variable: "--font-geist-sans", weight: "100 900", display: "swap" });
const geistMono = localFont({ src: "./fonts/GeistMono-Variable.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });
const display = localFont({ src: "./fonts/SpaceGrotesk-Variable.woff2", variable: "--font-space-grotesk", weight: "300 700", display: "swap" });

export const metadata: Metadata = {
  // Shared-link pictures need full addresses.
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: site.name, template: `%s · ${site.name}` },
  description: "Upload an STL file, set the size, material and colour, and see the price before you pay. PLA, PETG and PLA-CF prints for local pickup or shipping in Canada.",
  // Installed on an iPhone home screen: full screen, with this name under the icon.
  appleWebApp: { capable: true, title: "Coastline", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a1520" },
    { media: "(prefers-color-scheme: light)", color: "#f5f8fb" },
  ],
  // Lets the installed app draw under the notch; the header and footer pad themselves clear of it.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The theme choice lives in a cookie so the server renders it directly (no flash, no inline script).
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  // The holiday theme the owner has switched on (blue unless they've picked one).
  const season = await getSeason();
  const seasonStyle = seasonCss(season);
  const announcement = await liveAnnouncement();
  return (
    <html
      lang="en"
      data-theme={theme}
      data-season={season.id}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {seasonStyle && <style>{seasonStyle}</style>}
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-md bg-sand px-4 py-2 font-semibold text-black">
          Skip to content
        </a>
        <Providers season={season}>
          {announcement && <AnnouncementBar a={announcement} />}
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
