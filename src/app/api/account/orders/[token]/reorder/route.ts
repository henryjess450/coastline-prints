import { NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/account/auth";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import type { ColorSlot } from "@/lib/model/colors";
import { toUploadDto, type UploadDto } from "@/lib/uploads";

export const runtime = "nodejs";

export type ReorderItem = {
  upload: UploadDto;
  unitFactor: number;
  scale: { x: number; y: number; z: number };
  material: string;
  colorId: string;
  /** Multicolour: file colour number → stock colour id. */
  colorMap: Record<string, string> | null;
  quality: string;
  infill: string;
  quantity: number;
};

/**
 * "Print it again": the files and settings of one of your past orders, so
 * the cart can be filled with them. Only for the account that placed it.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const account = await customerFromRequest(req);
  if (!account) return apiError(401, "Please sign in again.");
  const { token } = await ctx.params;
  const order = await db.order.findUnique({ where: { viewToken: token }, include: { items: { include: { upload: true } } } });
  if (!order || order.customerEmail.toLowerCase() !== account.email.toLowerCase()) return apiError(404, "Order not found.");
  // Shop products aren't files to print again; they're bought from the shop.
  const files = order.items.filter((i) => i.upload);
  const gone = files.filter((i) => i.upload!.fileDeletedAt);
  if (!files.length) return apiError(404, "This order has no files to print again.");
  if (gone.length === files.length) return apiError(410, "The files for this order have been removed (we keep them for 90 days after pickup).");

  const items: ReorderItem[] = files
    .filter((i) => !i.upload!.fileDeletedAt)
    .map((i) => ({
      upload: toUploadDto(i.upload!),
      unitFactor: i.unitFactor,
      scale: { x: i.scaleX, y: i.scaleY, z: i.scaleZ },
      material: i.material,
      colorId: i.colorId,
      colorMap: i.colorSlots ? Object.fromEntries((JSON.parse(i.colorSlots) as ColorSlot[]).map((s) => [String(s.filament), s.colorId])) : null,
      quality: i.quality,
      infill: i.infill,
      quantity: i.quantity,
    }));
  return NextResponse.json({ items, missing: gone.map((i) => i.fileName) });
}
