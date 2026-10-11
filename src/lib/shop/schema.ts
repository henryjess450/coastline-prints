import { z } from "zod";
import { lightlab } from "@config/lightlab";

export const shopLineSchema = z.object({
  productId: z.string().min(1).max(40),
  variantId: z.string().min(1).max(40).nullable().default(null),
  quantity: z.number().int().min(1).max(lightlab.maxQuantityPerLine),
});

export const shopCartSchema = z.object({
  products: z.array(shopLineSchema).min(1).max(lightlab.maxLinesPerOrder),
});
