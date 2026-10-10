import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { uploads } from "@config/site";
import { apiError, logError } from "@/lib/api";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { sanitizeFilename } from "@/lib/sanitize";
import { getStorage } from "@/lib/storage";
import { inspectModel } from "@/lib/stl/inspect";
import { extensionFor, ModelParseError, parseModel, type ColorInfo } from "@/lib/model/parse";
import { toUploadDto } from "@/lib/uploads";

export const runtime = "nodejs";

/**
 * Receives one STL or 3MF as a raw body (Content-Type: application/octet-stream,
 * filename in the X-Filename header, URI-encoded). Streams it with a hard
 * size cap, validates by content, computes authoritative stats and stores
 * the original bytes untouched.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`upload:${clientIp(req)}`, 30, 10 * 60_000);
  if (!limit.ok) return apiError(429, "Too many uploads. Please wait a few minutes and try again.", { retryAfter: limit.retryAfterS });

  const maxBytes = uploads.maxFileMb * 1024 * 1024;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return apiError(413, `Files must be under ${uploads.maxFileMb} MB.`);
  if (!req.body) return apiError(400, "No file was received.");

  let originalName = "model.stl";
  try {
    originalName = decodeURIComponent(req.headers.get("x-filename") ?? originalName).slice(0, 255);
  } catch {
    // keep the fallback name
  }

  let bytes: Uint8Array;
  try {
    bytes = await readCapped(req.body, maxBytes);
  } catch (err) {
    if (err instanceof TooLargeError) return apiError(413, `Files must be under ${uploads.maxFileMb} MB.`);
    logError("upload:read", err);
    return apiError(400, "The upload was interrupted. Please try again.");
  }

  let parsed;
  try {
    parsed = parseModel(bytes);
  } catch (err) {
    if (err instanceof ModelParseError) return apiError(422, err.message);
    logError("upload:parse", err);
    return apiError(422, "We couldn't read this file.");
  }

  try {
    const analysis = inspectModel(parsed.checkPositions);
    for (const note of parsed.notes) analysis.warnings.push({ code: "file-note", severity: "info", message: note });
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const safeName = sanitizeFilename(originalName, parsed.format === "3mf" ? "model.3mf" : "model.stl");
    const now = new Date();
    const storageKey = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${extensionFor(parsed.format)}`;

    await getStorage().put(storageKey, bytes);

    const { stats, topology } = analysis;
    const upload = await db.upload.create({
      data: {
        storageKey,
        originalName,
        safeName,
        sizeBytes: bytes.byteLength,
        sha256,
        format: parsed.format,
        supportInfo: JSON.stringify(parsed.supports),
        colorInfo: parsed.colors ? JSON.stringify({ filaments: parsed.colors.filaments, used: parsed.colors.used, notes: parsed.notes, shares: parsed.colors.shares, profile: parsed.colors.profile } satisfies ColorInfo) : null,
        triangleCount: stats.triangleCount,
        volumeMm3: stats.volumeMm3,
        surfaceAreaMm2: stats.surfaceAreaMm2,
        bboxX: stats.bbox.size.x,
        bboxY: stats.bbox.size.y,
        bboxZ: stats.bbox.size.z,
        boundaryEdges: topology.boundaryEdges,
        nonManifold: topology.nonManifoldEdges,
        warnings: JSON.stringify(analysis.warnings),
      },
    });

    return NextResponse.json({ upload: toUploadDto(upload) }, { status: 201 });
  } catch (err) {
    logError("upload:store", err);
    return apiError(500, "Something went wrong saving your file. Please try again.");
  }
}

class TooLargeError extends Error {}

async function readCapped(body: ReadableStream<Uint8Array>, maxBytes: number) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new TooLargeError();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
