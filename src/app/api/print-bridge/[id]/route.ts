import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { bridgeKeyOk, finishJob } from "@/lib/receipt/bridge";

export const runtime = "nodejs";

const bodySchema = z.object({ ok: z.boolean(), error: z.string().max(500).optional() });

/** The bridge says whether a job printed. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await bridgeKeyOk(req.headers.get("authorization")))) return apiError(401, "Unknown bridge key.");
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Send { ok, error? }.");
  const { id } = await params;
  const updated = await finishJob(id, parsed.data.ok, parsed.data.error);
  return NextResponse.json({ updated });
}
