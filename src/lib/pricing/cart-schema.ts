import { z } from "zod";
import { MATERIAL_IDS } from "@config/materials";
import { uploads } from "@config/site";

const scaleAxis = z.number().finite().min(0.001).max(1000);

/** One cart line as sent by the browser. Prices and sizes are never accepted from the client. */
export const cartItemSchema = z.object({
  uploadId: z.string().min(1).max(40),
  unitFactor: z.union([z.literal(1), z.literal(25.4)]),
  scale: z.object({ x: scaleAxis, y: scaleAxis, z: scaleAxis }),
  material: z.enum(MATERIAL_IDS),
  colorId: z.string().min(1).max(40),
  /** Multicolour 3MF: file filament number → stock colour id. Checked against the stored file. */
  colorMap: z.record(z.string().regex(/^\d{1,3}$/), z.string().min(1).max(40)).nullable().optional(),
  quality: z.string().min(1).max(20),
  infill: z.string().min(1).max(20),
  quantity: z.number().int().min(1).max(uploads.maxQuantityPerItem),
});

export const cartSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(uploads.maxFilesPerOrder),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;
