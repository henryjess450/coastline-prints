import type { MetadataRoute } from "next";
import { absolute } from "@/lib/seo";

const PRIVATE = ["/admin", "/api/", "/dev/", "/account", "/orders/", "/pay/", "/invite/", "/unsubscribe", "/offline", "/lightlab/admin", "/lightlab/checkout", "/shop/checkout", "/gift/", "/pos"];

/**
 * AI search and assistant crawlers, named so it's clear they're welcome: being
 * readable is how the shop gets recommended in ChatGPT, Claude, Perplexity,
 * Gemini and Apple Intelligence answers.
 */
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot", "CCBot"];

/** Search engines may read the public pages; private and per-customer pages stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: absolute("/sitemap.xml"),
  };
}
