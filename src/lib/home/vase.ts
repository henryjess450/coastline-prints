/**
 * The home page sample print: a twisted wave vase, printed in vase mode
 * (a single wall). Built in code so there's no STL to download. Units are mm,
 * Y is up, the base sits on y = 0.
 */
import * as THREE from "three";

export const VASE = {
  height: 120,
  layerMm: 1.2,
  lobes: 7,
  /** Full turns of twist from bottom to top. */
  twist: 0.35,
};

/** Wall radius at height y (mm) and angle theta. */
export function vaseRadius(y: number, theta: number) {
  const t = y / VASE.height;
  // Body: narrow foot, belly, waist, flared lip.
  const body = 26 + 14 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - 7 * Math.sin(Math.PI * t * 2.2) * t + 9 * Math.pow(t, 4);
  const wave = 2.4 * Math.sin(VASE.lobes * theta + VASE.twist * Math.PI * 2 * t);
  // A slight ridge per printed layer, so the layer lines catch the light.
  const f = (y / VASE.layerMm) % 1;
  const ridge = 0.22 * (1 - Math.abs(2 * f - 1));
  return body + wave + ridge;
}

export function makeVaseGeometry(detail: "high" | "low" = "high") {
  const rowsPerLayer = detail === "high" ? 3 : 1;
  const rows = Math.round((VASE.height / VASE.layerMm) * rowsPerLayer);
  const cols = detail === "high" ? 160 : 72;
  const positions: number[] = [];
  const index: number[] = [];

  for (let i = 0; i <= rows; i++) {
    const y = (i / rows) * VASE.height;
    for (let j = 0; j <= cols; j++) {
      const theta = (j / cols) * Math.PI * 2;
      const r = vaseRadius(y, theta);
      positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
    }
  }
  const row = cols + 1;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * row + j;
      const b = a + row;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // Closed base (vase mode prints a solid bottom).
  const centre = positions.length / 3;
  positions.push(0, 0, 0);
  for (let j = 0; j < cols; j++) index.push(centre, j, j + 1);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Rainbow by height, for the gradient spools. */
export function vaseRainbow(g: THREE.BufferGeometry) {
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / VASE.height;
    c.setHSL((0.95 - t * 0.85 + 1) % 1, 0.75, 0.55);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}
