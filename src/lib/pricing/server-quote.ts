import "server-only";
import { getEffectiveConfig } from "@/lib/config/effective";
import type { AppConfig } from "@/lib/config/types";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { computeMeshStats } from "@/lib/stl/analyze";
import { parseModel } from "@/lib/model/parse";
import type { CartItemInput } from "./cart-schema";
import { listNames, mappedColors, type ColorMap, type ColorSlot } from "@/lib/model/colors";
import type { ColorInfo } from "@/lib/model/parse";
import type { SupportProfile } from "@/lib/model/supports";
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
  const { positions } = parseModel(await getStorage().get(storageKey));
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
  lines: (CartItemInput & { fileName: string; colorName: string; size: ItemSpec["size"]; colorSlots: ColorSlot[] | null })[];
  config: AppConfig;
};

export class CartError extends Error {}

/**
 * The upload's support data. Uploads from before supports were priced don't
 * have it: work it out from the stored file once and keep it.
 */
async function supportsFor(u: { id: string; storageKey: string; supportInfo: string | null }): Promise<SupportProfile | null> {
  if (u.supportInfo) return JSON.parse(u.supportInfo) as SupportProfile;
  try {
    const parsed = parseModel(await getStorage().get(u.storageKey));
    await db.upload.update({ where: { id: u.id }, data: { supportInfo: JSON.stringify(parsed.supports) } });
    return parsed.supports;
  } catch {
    return null;
  }
}

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

    const matColors = config.materials.find((m) => m.id === item.material)?.colors ?? [];
    const nameOf = (id: string) => matColors.find((c) => c.id === id)?.name ?? id;

    // Multicolour: only for painted files, and only with a colour for exactly the colours the file uses.
    const info = u.colorInfo ? (JSON.parse(u.colorInfo) as ColorInfo) : null;
    let colorMap: ColorMap | null = null;
    if (item.colorMap && info && info.used.length > 1) {
      const keys = Object.keys(item.colorMap).map(Number).sort((a, b) => a - b);
      if (keys.join() !== info.used.join()) throw new CartError(`The colours chosen for ${u.safeName} don't match the file. Please pick them again.`);
      colorMap = item.colorMap;
    }
    const mixed = colorMap ? mappedColors(colorMap, info?.shares, matColors) : null;
    const colorId = mixed?.[0]?.id ?? item.colorId;
    const colorName = mixed ? listNames(mixed.map((m) => m.color?.name ?? m.id)) : nameOf(item.colorId);
    const colorSlots = colorMap
      ? info!.used.map((n) => ({ filament: n, fileHex: info!.filaments[n - 1]?.hex ?? null, colorId: colorMap![n], colorName: nameOf(colorMap![n]), hex: matColors.find((c) => c.id === colorMap![n])?.hex ?? "#888888" }))
      : null;

    const supportProfile = await supportsFor(u);
    specs.push({ size, volumeMm3, surfaceAreaMm2, material: item.material, colorId, colorMap, colorShares: info?.shares, colorProfile: info?.profile, supportProfile, scale, quality: item.quality, infill: item.infill, quantity: item.quantity });
    lines.push({ ...item, colorId, colorMap, fileName: u.safeName, colorName, size, colorSlots });
  }

  return { ...quoteOrder(specs, config), lines, config };
}
