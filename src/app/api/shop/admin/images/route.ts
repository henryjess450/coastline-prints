import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { lightlab } from "@config/lightlab";
import { requestIsAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { shopImageUrl } from "@/lib/shop/types";

export const runtime = "nodejs";

/** What the file really is, from its first bytes (never the name or browser's say-so). */
function sniff(b: Uint8Array) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

/** Admin: upload one product photo. Returns its storage key; saving the product attaches it. */
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return apiError(401, "Please log in again.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return apiError(400, "No photo was sent.");
  if (file.size > lightlab.maxImageMb * 1024 * 1024) return apiError(413, `Photos must be under ${lightlab.maxImageMb} MB.`);
  const data = new Uint8Array(await file.arrayBuffer());
  const ext = sniff(data);
  if (!ext) return apiError(415, "Please use a JPG, PNG or WebP photo.");
  const key = `shop/${randomBytes(12).toString("hex")}.${ext}`;
  await getStorage().put(key, data);
  return NextResponse.json({ key, url: shopImageUrl(key) });
}
