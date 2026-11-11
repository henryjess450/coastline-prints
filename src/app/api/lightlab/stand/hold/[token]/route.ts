import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** The customer can't make it: let the lamp go for someone else. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { count } = await db.standHold.updateMany({ where: { token: (await ctx.params).token, status: "HELD" }, data: { status: "CANCELLED" } });
  if (!count) return apiError(404, "That hold isn't active any more.");
  return NextResponse.json({ ok: true });
}
