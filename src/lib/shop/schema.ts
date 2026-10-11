import { z } from "zod";
import { lightlab } from "@config/lightlab";
import { CUSTOM_TEXT_MAX } from "./types";

export const shopLineSchema = z.object({
  productId: z.string().min(1).max(40),
  variantId: z.string().min(1).max(40).nullable().default(null),
  quantity: z.number().int().min(1).max(lightlab.maxQuantityPerLine),
  customText: z.string().trim().max(CUSTOM_TEXT_MAX).nullable().optional().transform((t) => t || null),
});

export const shopCartSchema = z.object({
  products: z.array(shopLineSchema).min(1).max(lightlab.maxLinesPerOrder),
});
