import { NextResponse } from "next/server";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { pushScreen } from "@/lib/pos/register.server";
import type { PosReply, PosScreen } from "@/lib/pos/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** The register polls this for the customer's answer to a popup, and whether the display is still there. */
export async function GET(req: Request, ctx: Ctx) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const r = await db.posRegister.findUnique({ where: { id: (await ctx.params).id } });
  if (!r?.pairedAt) return apiError(404, "That display was unpaired.");
  return NextResponse.json({ reply: r.reply ? (JSON.parse(r.reply) as PosReply) : null, version: r.version, online: Date.now() - r.lastSeenAt.getTime() < 60_000 }, { headers: { "Cache-Control": "no-store" } });
}

const STAGES = ["idle", "cart", "done"];

/** What the display shows now. */
export async function PUT(req: Request, ctx: Ctx) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  const body = (await req.json().catch(() => null)) as { screen?: PosScreen; clearReply?: boolean } | null;
  if (!body?.screen || !STAGES.includes(body.screen.stage) || JSON.stringify(body.screen).length > 50_000) return apiError(400, "Bad screen.");
  if (!(await pushScreen((await ctx.params).id, body.screen, { clearReply: !!body.clearReply }))) return apiError(404, "That display was unpaired.");
  return NextResponse.json({ ok: true });
}

/** Unpair: the display goes back to showing a new pair code. */
export async function DELETE(req: Request, ctx: Ctx) {
  if (!requestIsAdmin(req)) return apiError(401, "Not logged in.");
  await db.posRegister.deleteMany({ where: { id: (await ctx.params).id } });
  return NextResponse.json({ ok: true });
}
