/**
 * Geometry math shared by the browser and the server. Pure functions over a
 * flat triangle position array, so client and server results are identical.
 */

export type Vec3 = { x: number; y: number; z: number };

export type BoundingBox = { min: Vec3; max: Vec3; size: Vec3 };

export type MeshStats = {
  triangleCount: number;
  bbox: BoundingBox;
  /** Absolute enclosed volume, mm³. */
  volumeMm3: number;
  /** Signed volume; negative means the triangle winding is inverted. */
  signedVolumeMm3: number;
  surfaceAreaMm2: number;
};

export type Topology = {
  boundaryEdges: number;
  nonManifoldEdges: number;
  uniqueVertices: number;
};

const ONE: Vec3 = { x: 1, y: 1, z: 1 };

/**
 * Bounding box, signed-tetrahedron volume and surface area, with an optional
 * per-axis scale applied (so callers can measure a resized model exactly).
 */
export function computeMeshStats(positions: ArrayLike<number>, scale: Vec3 = ONE): MeshStats {
  const sx = scale.x, sy = scale.y, sz = scale.z;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let signed = 0;
  let area = 0;

  for (let i = 0; i + 8 < positions.length; i += 9) {
    const ax = positions[i] * sx, ay = positions[i + 1] * sy, az = positions[i + 2] * sz;
    const bx = positions[i + 3] * sx, by = positions[i + 4] * sy, bz = positions[i + 5] * sz;
    const cx = positions[i + 6] * sx, cy = positions[i + 7] * sy, cz = positions[i + 8] * sz;

    if (ax < minX) minX = ax; if (ax > maxX) maxX = ax;
    if (bx < minX) minX = bx; if (bx > maxX) maxX = bx;
    if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
    if (ay < minY) minY = ay; if (ay > maxY) maxY = ay;
    if (by < minY) minY = by; if (by > maxY) maxY = by;
    if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
    if (az < minZ) minZ = az; if (az > maxZ) maxZ = az;
    if (bz < minZ) minZ = bz; if (bz > maxZ) maxZ = bz;
    if (cz < minZ) minZ = cz; if (cz > maxZ) maxZ = cz;

    // Signed volume of the tetrahedron (origin, a, b, c) = a · (b × c) / 6
    signed += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;

    // Triangle area = |(b − a) × (c − a)| / 2
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    area += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
  }

  const triangleCount = Math.floor(positions.length / 9);
  if (triangleCount === 0) {
    const zero = { x: 0, y: 0, z: 0 };
    return { triangleCount: 0, bbox: { min: zero, max: zero, size: zero }, volumeMm3: 0, signedVolumeMm3: 0, surfaceAreaMm2: 0 };
  }

  return {
    triangleCount,
    bbox: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
    },
    volumeMm3: Math.abs(signed),
    signedVolumeMm3: signed,
    surfaceAreaMm2: area,
  };
}

/**
 * Edge topology check. Welds coincident vertices (0.001 mm grid), then counts
 * how many triangles share each edge: a closed, manifold mesh has exactly 2.
 * Uses typed arrays + a sort instead of string-keyed maps so multi-million
 * triangle files stay fast and memory-light.
 */
export function computeTopology(positions: ArrayLike<number>): Topology {
  const triCount = Math.floor(positions.length / 9);
  const vertCount = triCount * 3;
  const ids = weldVertices(positions, vertCount);
  const uniqueVertices = ids.unique;

  const edges = new Float64Array(triCount * 3);
  let e = 0;
  for (let t = 0; t < triCount; t++) {
    const a = ids.map[t * 3], b = ids.map[t * 3 + 1], c = ids.map[t * 3 + 2];
    if (a === b || b === c || a === c) continue; // degenerate sliver, ignore
    edges[e++] = edgeKey(a, b, uniqueVertices);
    edges[e++] = edgeKey(b, c, uniqueVertices);
    edges[e++] = edgeKey(c, a, uniqueVertices);
  }
  const sorted = edges.subarray(0, e).sort();

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (let i = 0; i < sorted.length; ) {
    let j = i + 1;
    while (j < sorted.length && sorted[j] === sorted[i]) j++;
    const uses = j - i;
    if (uses === 1) boundaryEdges++;
    else if (uses > 2) nonManifoldEdges++;
    i = j;
  }
  return { boundaryEdges, nonManifoldEdges, uniqueVertices };
}

function edgeKey(a: number, b: number, n: number) {
  return a < b ? a * n + b : b * n + a;
}

/** Open-addressing hash of quantized coordinates → vertex index. */
function weldVertices(positions: ArrayLike<number>, vertCount: number) {
  let capacity = 1;
  while (capacity < vertCount * 2) capacity <<= 1;
  const mask = capacity - 1;
  const slots = new Int32Array(capacity).fill(-1);
  const keys = new Int32Array(vertCount * 3);
  const map = new Int32Array(vertCount);
  let unique = 0;

  for (let v = 0; v < vertCount; v++) {
    const qx = Math.round(positions[v * 3] * 1000) | 0;
    const qy = Math.round(positions[v * 3 + 1] * 1000) | 0;
    const qz = Math.round(positions[v * 3 + 2] * 1000) | 0;
    let h = (Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663) ^ Math.imul(qz, 83492791)) & mask;
    for (;;) {
      const slot = slots[h];
      if (slot === -1) {
        slots[h] = unique;
        keys[unique * 3] = qx;
        keys[unique * 3 + 1] = qy;
        keys[unique * 3 + 2] = qz;
        map[v] = unique++;
        break;
      }
      if (keys[slot * 3] === qx && keys[slot * 3 + 1] === qy && keys[slot * 3 + 2] === qz) {
        map[v] = slot;
        break;
      }
      h = (h + 1) & mask;
    }
  }
  return { map, unique };
}
