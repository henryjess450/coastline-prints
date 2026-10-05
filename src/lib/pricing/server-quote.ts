import "server-only";
import { getEffectiveConfig } from "@/lib/config/effective";
import type { AppConfig } from "@/lib/config/types";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { computeMeshStats } from "@/lib/stl/analyze";
import { parseStl } from "@/lib/stl/parse";
import type { CartItemInput } from "./cart-schema";
import { quoteOrder, type ItemSpec, type OrderQuote } from "./quote";

/** Small LRU of parsed meshes so repeated quotes don't re-read files from disk. */
const MAX_CACHE_BYTES = 300 * 1024 * 1024;
const meshCache = new Map<string, Float32Array>();
let cacheBytes = 0;

async function loadPositions(uploadId: string, storageKey: string) {
  const hit = meshCache.get(uploadId);
  if (hit) {
    meshCache.delete(uploadId);
    meshCache.set(uploadId, hit);
    return hit;
  }
  const { positions } = parseStl(await getStorage().get(storageKey));
  meshCache.set(uploadId, positions);
  cacheBytes += positions.byteLength;
  for (const [key, value] of meshCache) {
    if (cacheBytes <= MAX_CACHE_BYTES || key === uploadId) break;
    meshCache.delete(key);
    cacheBytes -= value.byteLength;
  }
  return positions;
}

export type PricedCart = OrderQuote & {
  lines: (CartItemInput & { fileName: string; colorName: string; size: ItemSpec["size"] })[];
  config: AppConfig;
};

export class CartError extends Error {}

/**
 * The authoritative price. Recomputes size, volume and area from the stored
 * file (never from client numbers), assigns printers and prices the order.
 */
export async function priceCart(items: CartItemInput[], cfg?: AppConfig): Promise<PricedCart> {
  const config = cfg ?? (await getEffectiveConfig());
  const ids = [...new Set(items.map((i) => i.uploadId))];
  const uploads = await db.upload.findMany({ where: { id: { in: ids } } });
  const byId = new Map(uploads.map((u) => [u.id, u]));

  const specs: ItemSpec[] = [];
  const lines: PricedCart["lines"] = [];
  for (const item of items) {
    const u = byId.get(item.uploadId);
    if (!u) throw new CartError("One of your files has expired. Please upload it again.");
    const k = item.unitFactor;
    const scale = { x: item.scale.x * k, y: item.scale.y * k, z: item.scale.z * k };
    const size = { x: u.bboxX * scale.x, y: u.bboxY * scale.y, z: u.bboxZ * scale.z };
    const volumeMm3 = u.volumeMm3 * scale.x * scale.y * scale.z;

    const uniform = scale.x === scale.y && scale.y === scale.z;
    const surfaceAreaMm2 = uniform
      ? u.surfaceAreaMm2 * scale.x * scale.x
      : computeMeshStats(await loadPositions(u.id, u.storageKey), scale).surfaceAreaMm2;

    specs.push({ size, volumeMm3, surfaceAreaMm2, material: item.material, colorId: item.colorId, quality: item.quality, infill: item.infill, quantity: item.quantity });
    const colorName = config.materials.find((m) => m.id === item.material)?.colors.find((c) => c.id === item.colorId)?.name ?? item.colorId;
    lines.push({ ...item, fileName: u.safeName, colorName, size });
  }

  return { ...quoteOrder(specs, config), lines, config };
}
