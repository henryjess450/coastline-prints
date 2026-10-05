/** Procedural meshes with known geometry, for tests and sample files. */

type Tri = [number, number, number, number, number, number, number, number, number];

/** Axis-aligned box from (0,0,0) to (w,d,h), outward-facing (CCW) winding. */
export function boxTriangles(w: number, d: number, h: number, offset = { x: 0, y: 0, z: 0 }): Tri[] {
  const v = (x: number, y: number, z: number) => [x * w + offset.x, y * d + offset.y, z * h + offset.z];
  const quad = (a: number[], b: number[], c: number[], e: number[]): Tri[] => [
    [...a, ...b, ...c] as Tri,
    [...a, ...c, ...e] as Tri,
  ];
  const p000 = v(0, 0, 0), p100 = v(1, 0, 0), p110 = v(1, 1, 0), p010 = v(0, 1, 0);
  const p001 = v(0, 0, 1), p101 = v(1, 0, 1), p111 = v(1, 1, 1), p011 = v(0, 1, 1);
  return [
    ...quad(p000, p010, p110, p100), // bottom (−z)
    ...quad(p001, p101, p111, p011), // top (+z)
    ...quad(p000, p100, p101, p001), // front (−y)
    ...quad(p010, p011, p111, p110), // back (+y)
    ...quad(p000, p001, p011, p010), // left (−x)
    ...quad(p100, p110, p111, p101), // right (+x)
  ];
}

/** Closed UV sphere approximation. */
export function sphereTriangles(r: number, seg = 48, rings = 24): Tri[] {
  const pt = (i: number, j: number) => {
    const th = (j / rings) * Math.PI;
    const ph = (i / seg) * Math.PI * 2;
    return [r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)];
  };
  const tris: Tri[] = [];
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      if (j !== 0) tris.push([...a, ...c, ...b] as Tri);
      if (j !== rings - 1) tris.push([...a, ...d, ...c] as Tri);
    }
  }
  return tris;
}

export function toPositions(tris: Tri[]) {
  return Float32Array.from(tris.flat());
}

export function toBinaryStl(tris: Tri[], header = "binary stl") {
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buf);
  new TextEncoder().encodeInto(header.padEnd(80, " ").slice(0, 80), new Uint8Array(buf, 0, 80));
  view.setUint32(80, tris.length, true);
  let o = 84;
  for (const t of tris) {
    o += 12;
    for (const n of t) {
      view.setFloat32(o, n, true);
      o += 4;
    }
    o += 2;
  }
  return new Uint8Array(buf);
}

export function toAsciiStl(tris: Tri[], name = "test") {
  const lines = [`solid ${name}`];
  for (const t of tris) {
    lines.push("  facet normal 0 0 0", "    outer loop");
    for (let k = 0; k < 9; k += 3) lines.push(`      vertex ${t[k]} ${t[k + 1]} ${t[k + 2]}`);
    lines.push("    endloop", "  endfacet");
  }
  lines.push(`endsolid ${name}`);
  return new TextEncoder().encode(lines.join("\n"));
}
