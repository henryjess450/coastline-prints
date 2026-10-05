import { z } from "zod";
import { MATERIAL_IDS } from "@config/materials";

/** Validation for admin-editable settings (stored as JSON in the Setting table). */
export const pricingSchema = z.object({
  baseFeeCents: z.number().int().min(0).max(100_000),
  pricePerGramCents: z.number().min(0).max(1_000),
  pricePerHourCents: z.number().min(0).max(100_000),
  markupPerPieceCents: z.number().int().min(0).max(100_000),
  minimumOrderCents: z.number().int().min(0).max(1_000_000),
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const colorSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(80),
  hex,
  finish: z.enum(["matte", "solid", "silk", "translucent", "wood", "gradient"]),
  pricePerGramCents: z.number().min(0).max(1_000).optional(),
  available: z.boolean(),
});

export const materialSchema = z.object({
  id: z.enum(MATERIAL_IDS),
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(300),
  densityGPerCm3: z.number().min(0.5).max(3),
  colors: z.array(colorSchema).max(60),
});

export const materialsSchema = z.array(materialSchema).length(MATERIAL_IDS.length);
