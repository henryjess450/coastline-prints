/**
 * A flat front view of a model (looking along Y, Z up, as it sits on the
 * printer) drawn in its filament colour with faint layer lines, for the
 * order send-off animation. Runs in the browser on the parsed STL.
 */
export type Silhouette = { src: string; width: number; height: number };

const MAX_TRIANGLES = 400_000;

export function modelSilhouette(positions: Float32Array, color: string, size = 240): Silhouette | null {
  if (typeof document === "undefined" || positions.length < 9) return null;
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
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // One path of every projected triangle. Each is wound the same way, so the
  // nonzero fill never cancels where front and back faces overlap.
  const triangles = positions.length / 9;
  const step = Math.max(1, Math.ceil(triangles / MAX_TRIANGLES));
  const px = (x: number) => pad + (x - minX) * scale;
  const pz = (z: number) => ch - pad - (z - minZ) * scale;
  ctx.beginPath();
  for (let t = 0; t < triangles; t += step) {
    const o = t * 9;
    const ax = px(positions[o]), ay = pz(positions[o + 2]);
    let bx = px(positions[o + 3]), by = pz(positions[o + 5]);
    let cx = px(positions[o + 6]), cy = pz(positions[o + 8]);
    if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0) [bx, by, cx, cy] = [cx, cy, bx, by];
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.closePath();
  }
  ctx.fillStyle = color;
  ctx.fill("nonzero");

  // Printed look: a faint darker line every few pixels, only on the model.
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
  for (let y = ch - 3; y > 0; y -= 4) ctx.fillRect(0, y, cw, 1);
  ctx.globalCompositeOperation = "source-over";

  return { src: canvas.toDataURL("image/png"), width: cw, height: ch };
}
