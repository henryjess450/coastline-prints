/**
 * A flat front view of a model (looking along Y, Z up, as it sits on the
 * printer) drawn in its filament colour with faint layer lines, for the
 * order send-off animation. Runs in the browser on the parsed STL.
 *
 * It's rasterised straight into a small pixel grid (one pass over the
 * triangles, each filling only the few pixels it covers) instead of building
 * a canvas path, so even a multi-million-triangle file takes a moment, not
 * long enough to freeze the page.
 */
export type Silhouette = { src: string; width: number; height: number };

export function modelSilhouette(positions: Float32Array, color: string, size = 240): Silhouette | null {
  if (typeof document === "undefined") return null;
  const raster = rasterizeSilhouette(positions, size);
  if (!raster) return null;
  const { grid, width: cw, height: ch } = raster;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const [r, g, b] = hexToRgb(color);
  const img = ctx.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) {
    // Printed look: every fourth row a little darker, like layer lines.
    const shade = (ch - 1 - y) % 4 === 0 ? 0.84 : 1;
    for (let x = 0; x < cw; x++) {
      if (!grid[y * cw + x]) continue;
      const i = (y * cw + x) * 4;
      img.data[i] = r * shade;
      img.data[i + 1] = g * shade;
      img.data[i + 2] = b * shade;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { src: canvas.toDataURL("image/png"), width: cw, height: ch };
}

/** The silhouette as a grid of filled (1) and empty (0) pixels. No DOM needed. */
export function rasterizeSilhouette(positions: Float32Array, size = 240) {
  if (positions.length < 9) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], z = positions[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const w = maxX - minX, h = maxZ - minZ;
  if (!(w > 0 && h > 0)) return null;

  const pad = 2;
  const scale = (size - pad * 2) / Math.max(w, h);
  const cw = Math.max(8, Math.ceil(w * scale) + pad * 2);
  const ch = Math.max(8, Math.ceil(h * scale) + pad * 2);
  const grid = new Uint8Array(cw * ch);

  for (let o = 0; o < positions.length - 8; o += 9) {
    // Projected corners in pixel space (y grows downward).
    const ax = pad + (positions[o] - minX) * scale, ay = ch - pad - (positions[o + 2] - minZ) * scale;
    const bx = pad + (positions[o + 3] - minX) * scale, by = ch - pad - (positions[o + 5] - minZ) * scale;
    const cx = pad + (positions[o + 6] - minX) * scale, cy = ch - pad - (positions[o + 8] - minZ) * scale;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(cw - 1, Math.floor(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(ch - 1, Math.floor(Math.max(ay, by, cy)));
    // Tiny triangles (most of a dense mesh) cover at most one pixel: mark it and move on.
    if (x0 === x1 && y0 === y1) {
      grid[y0 * cw + x0] = 1;
      continue;
    }
    // Otherwise fill the pixels whose centres fall inside, whichever way it's wound.
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (area === 0) continue;
    const sign = area > 0 ? 1 : -1;
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const e0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) * sign;
        const e1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) * sign;
        const e2 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) * sign;
        if (e0 >= 0 && e1 >= 0 && e2 >= 0) grid[y * cw + x] = 1;
      }
    }
    // Make sure thin slivers still leave a mark at their corners.
    grid[Math.min(ch - 1, Math.max(0, Math.floor(ay))) * cw + Math.min(cw - 1, Math.max(0, Math.floor(ax)))] = 1;
  }

  return { grid, width: cw, height: ch };
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x3d7bb8;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
