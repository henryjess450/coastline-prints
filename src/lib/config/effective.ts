import "server-only";
import { db } from "@/lib/db";
import { logError } from "@/lib/api";
import { canadaPostConfigured, postageTax } from "@/lib/shipping/canada-post";
import { materialsSchema, pricingSchema } from "./schema";
import { defaultConfig, type AppConfig } from "./types";

/**
 * Defaults from config/*.ts with admin overrides applied. An invalid stored
 * override is ignored (and logged) rather than breaking pricing.
 */
export async function getEffectiveConfig(): Promise<AppConfig> {
  const cfg = defaultConfig();
  const rows = await db.setting.findMany({ where: { key: { in: ["pricing", "materials"] } } });
  for (const row of rows) {
    try {
      const value = JSON.parse(row.value);
      if (row.key === "pricing") cfg.pricing = pricingSchema.parse({ ...cfg.pricing, ...value });
      if (row.key === "materials") cfg.materials = materialsSchema.parse(value);
    } catch (err) {
      logError(`config:${row.key}`, err);
    }
  }
  // Tracked parcel mailers need live Canada Post rates; without API keys, don't offer them.
  if (!canadaPostConfigured()) cfg.shipping.mailer.parcel.enabled = false;
  // Tax on postage, live from Canada Post when it can be (cached), so a GST/HST change follows through.
  cfg.shipping.tax = await postageTax();
  return cfg;
}
