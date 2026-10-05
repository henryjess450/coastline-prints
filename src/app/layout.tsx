import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import { site } from "@config/site";
import { Providers } from "@/components/layout/Providers";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: site.name, template: `%s · ${site.name}` },
  description: "Upload an STL file, set the size, material and colour, and see the price before you pay. PLA, PETG and PLA-CF prints for local pickup.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1014" },
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The theme choice lives in a cookie so the server renders it directly (no flash, no inline script).
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  return (
    <html
      lang="en"
      data-theme={theme}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-md bg-sand px-4 py-2 font-semibold text-black">
          Skip to content
        </a>
        <Providers>
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
