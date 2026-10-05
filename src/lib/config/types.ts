/**
 * The runtime configuration the app actually uses: defaults from config/*.ts,
 * overlaid with anything changed in admin settings. Plain data, safe to send
 * to the browser (it contains no private details like the pickup address).
 */
import { materials, type MaterialConfig } from "@config/materials";
import { printers, SAFETY_MARGIN_MM, type PrinterConfig } from "@config/printers";
import { estimation, infillPresets, pricing, qualityPresets } from "@config/pricing";

export type PricingRates = typeof pricing;

export type AppConfig = {
  pricing: PricingRates;
  materials: MaterialConfig[];
  printers: PrinterConfig[];
  safetyMarginMm: number;
  qualityPresets: { id: string; name: string; layerHeightMm: number; gramsPerHour: number; description: string }[];
  infillPresets: { id: string; name: string; infillFraction: number; description: string }[];
  estimation: typeof estimation;
};

export function defaultConfig(): AppConfig {
  return structuredClone({
    pricing,
    materials,
    printers,
    safetyMarginMm: SAFETY_MARGIN_MM,
    qualityPresets: [...qualityPresets],
    infillPresets: [...infillPresets],
    estimation,
  }) as AppConfig;
}
