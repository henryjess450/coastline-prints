/**
 * Strict STL parser (binary + ASCII) used as the authoritative server parser.
 * Validates by content, not extension. Returns a flat Float32Array of
 * triangle vertex positions: [x0,y0,z0, x1,y1,z1, x2,y2,z2, ...] in file units.
 */

export class StlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StlParseError";
  }
}

export type StlFormat = "binary" | "ascii";

export type ParsedStl = {
  format: StlFormat;
  positions: Float32Array;
  triangleCount: number;
};

const BINARY_HEADER = 80;
const BINARY_TRIANGLE = 50;
const MAX_TRIANGLES = 10_000_000;

export function detectStlFormat(bytes: Uint8Array): StlFormat | null {
  if (bytes.byteLength >= BINARY_HEADER + 4) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint32(BINARY_HEADER, true);
    // Exact size match is the reliable binary signal (many binary headers start with "solid").
    if (BINARY_HEADER + 4 + count * BINARY_TRIANGLE === bytes.byteLength) return "binary";
  }
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.byteLength, 1024)));
  if (/^\s*solid\b/i.test(head) && /\b(facet|endsolid)\b/i.test(head + tailText(bytes))) return "ascii";
  return null;
}

function tailText(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.byteLength - 256)));
}

export function parseStl(input: ArrayBuffer | Uint8Array): ParsedStl {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const format = detectStlFormat(bytes);
  if (!format) throw new StlParseError("This doesn't look like an STL file.");
  return format === "binary" ? parseBinary(bytes) : parseAscii(bytes);
}

function parseBinary(bytes: Uint8Array): ParsedStl {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangleCount = view.getUint32(BINARY_HEADER, true);
  if (triangleCount === 0) throw new StlParseError("The STL file contains no triangles.");
  if (triangleCount > MAX_TRIANGLES) throw new StlParseError("The model has too many triangles to process.");

  const positions = new Float32Array(triangleCount * 9);
  let offset = BINARY_HEADER + 4;
  for (let t = 0; t < triangleCount; t++) {
    offset += 12; // skip the stored normal; we derive geometry from vertices only
    for (let k = 0; k < 9; k++) {
      positions[t * 9 + k] = view.getFloat32(offset, true);
      offset += 4;
    }
    offset += 2; // attribute byte count
  }
  assertFinite(positions);
  return { format: "binary", positions, triangleCount };
}

function parseAscii(bytes: Uint8Array): ParsedStl {
  const text = new TextDecoder().decode(bytes);
  const vertexRe = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi;
  const values: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = vertexRe.exec(text))) {
    values.push(Number(match[1]), Number(match[2]), Number(match[3]));
    if (values.length > MAX_TRIANGLES * 9) throw new StlParseError("The model has too many triangles to process.");
  }
  if (values.length === 0) throw new StlParseError("The STL file contains no triangles.");
  if (values.length % 9 !== 0) throw new StlParseError("The STL file is truncated or malformed.");
  const positions = Float32Array.from(values);
  assertFinite(positions);
  return { format: "ascii", positions, triangleCount: positions.length / 9 };
}

function assertFinite(positions: Float32Array) {
  for (let i = 0; i < positions.length; i++) {
    if (!Number.isFinite(positions[i])) throw new StlParseError("The STL file contains invalid coordinates.");
  }
}
