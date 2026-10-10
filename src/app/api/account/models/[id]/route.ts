import { NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/account/auth";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import type { ColorSlot } from "@/lib/model/colors";
import { toUploadDto } from "@/lib/uploads";
import type { ReorderItem } from "../../orders/[token]/reorder/route";

export const runtime = "nodejs";

/** One of your models with the settings you last ordered it in, for the cart. Owner only. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const account = await customerFromRequest(req);
  if (!account) return apiError(401, "Please sign in again.");
  const { id } = await ctx.params;
  const last = await db.orderItem.findFirst({
    where: { uploadId: id, order: { customerEmail: account.email } },
    orderBy: { order: { createdAt: "desc" } },
    include: { upload: true },
  });
  if (!last) return apiError(404, "Model not found.");
  if (last.upload.fileDeletedAt) return apiError(410, "This file has been removed (we keep files for 90 days after pickup).");
  const item: ReorderItem = {
    upload: toUploadDto(last.upload),
    unitFactor: last.unitFactor,
    scale: { x: last.scaleX, y: last.scaleY, z: last.scaleZ },
    material: last.material,
    colorId: last.colorId,
    colorMap: last.colorSlots ? Object.fromEntries((JSON.parse(last.colorSlots) as ColorSlot[]).map((s) => [String(s.filament), s.colorId])) : null,
    quality: last.quality,
    infill: last.infill,
    quantity: 1,
  };
  return NextResponse.json({ items: [item], missing: [] });
}
