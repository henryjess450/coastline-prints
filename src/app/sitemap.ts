import type { MetadataRoute } from "next";
import { absolute } from "@/lib/seo";
import { guides } from "@/lib/guides";
import { uses } from "@/lib/uses";

/**
 * Public pages for search engines. LightLab is left out while its links are
 * hidden from the site; add "/lightlab" here when it goes public.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: "weekly" | "monthly" | "yearly" = "monthly") => ({ url: absolute(path), priority, changeFrequency });
  return [
    page("/", 1, "weekly"),
    page("/order", 0.9),
    page("/3d-printing", 0.8),
    ...uses.map((u) => page(`/3d-printing/${u.slug}`, 0.8)),
    page("/guides", 0.6),
    ...guides.map((g) => ({ ...page(`/guides/${g.slug}`, 0.7), lastModified: g.updated })),
    page("/faq", 0.7),
    page("/about", 0.6),
    page("/library", 0.6, "weekly"),
    page("/gift-cards", 0.6),
    page("/rewards", 0.4),
    page("/app", 0.3),
    page("/terms", 0.1, "yearly"),
    page("/privacy", 0.1, "yearly"),
  ];
}
