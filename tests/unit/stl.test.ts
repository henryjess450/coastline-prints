import { describe, expect, it } from "vitest";
import { computeMeshStats, computeTopology } from "@/lib/stl/analyze";
import { inspectModel } from "@/lib/stl/inspect";
import { detectStlFormat, parseStl, StlParseError } from "@/lib/stl/parse";
import { boxTriangles, sphereTriangles, toAsciiStl, toBinaryStl, toPositions } from "../helpers/meshes";

describe("STL parsing", () => {
  const tris = boxTriangles(20, 10, 5);

  it("parses binary and ASCII to identical positions", () => {
    const bin = parseStl(toBinaryStl(tris));
    const ascii = parseStl(toAsciiStl(tris));
    expect(bin.format).toBe("binary");
    expect(ascii.format).toBe("ascii");
    expect(bin.triangleCount).toBe(12);
    expect(Array.from(ascii.positions)).toEqual(Array.from(bin.positions));
  });

  it("detects binary even when the header starts with 'solid'", () => {
    expect(detectStlFormat(toBinaryStl(tris, "solid exported-by-cad"))).toBe("binary");
  });

  it("rejects files that are not STL by content", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(200).fill(0)]);
    expect(() => parseStl(png)).toThrow(StlParseError);
    expect(() => parseStl(new TextEncoder().encode("hello world, I am a .stl renamed text file"))).toThrow(StlParseError);
  });

  it("rejects a truncated binary file", () => {
    const bytes = toBinaryStl(tris);
    expect(() => parseStl(bytes.subarray(0, bytes.length - 10))).toThrow(StlParseError);
  });

  it("rejects an empty binary STL", () => {
    expect(() => parseStl(toBinaryStl([]))).toThrow(/no triangles/);
  });
});

describe("mesh stats", () => {
  it("computes bounding box, volume and area of a box exactly", () => {
    const s = computeMeshStats(toPositions(boxTriangles(20, 10, 5, { x: -3, y: 7, z: 2 })));
    expect(s.triangleCount).toBe(12);
    expect(s.bbox.min).toEqual({ x: -3, y: 7, z: 2 });
    expect(s.bbox.size).toEqual({ x: 20, y: 10, z: 5 });
    expect(s.volumeMm3).toBeCloseTo(1000, 6);
    expect(s.signedVolumeMm3).toBeGreaterThan(0);
    expect(s.surfaceAreaMm2).toBeCloseTo(2 * (200 + 100 + 50), 6);
  });

  it("volume is independent of position (signed tetrahedron method)", () => {
    const a = computeMeshStats(toPositions(boxTriangles(7, 8, 9)));
    const b = computeMeshStats(toPositions(boxTriangles(7, 8, 9, { x: 500, y: -200, z: 90 })));
    expect(b.volumeMm3).toBeCloseTo(a.volumeMm3, 2);
  });

  it("applies non-uniform scale to bbox, volume and area", () => {
    const s = computeMeshStats(toPositions(boxTriangles(10, 10, 10)), { x: 2, y: 1, z: 0.5 });
    expect(s.bbox.size).toEqual({ x: 20, y: 10, z: 5 });
    expect(s.volumeMm3).toBeCloseTo(1000, 6);
    expect(s.surfaceAreaMm2).toBeCloseTo(2 * (200 + 100 + 50), 6);
  });

  it("approximates a sphere's volume", () => {
    const s = computeMeshStats(toPositions(sphereTriangles(10, 96, 48)));
    expect(s.volumeMm3 / ((4 / 3) * Math.PI * 1000)).toBeGreaterThan(0.99);
    expect(s.bbox.size.z).toBeCloseTo(20, 3);
  });

  it("reports negative signed volume for inverted winding", () => {
    const flipped = boxTriangles(10, 10, 10).map((t) => [...t.slice(0, 3), ...t.slice(6, 9), ...t.slice(3, 6)] as typeof t);
    const s = computeMeshStats(toPositions(flipped));
    expect(s.signedVolumeMm3).toBeCloseTo(-1000, 6);
    expect(s.volumeMm3).toBeCloseTo(1000, 6);
  });
});

describe("mesh topology and warnings", () => {
  it("a closed box is watertight and manifold", () => {
    const t = computeTopology(toPositions(boxTriangles(10, 10, 10)));
    expect(t).toEqual({ boundaryEdges: 0, nonManifoldEdges: 0, uniqueVertices: 8 });
    expect(inspectModel(toPositions(boxTriangles(10, 10, 10))).warnings).toEqual([]);
  });

  it("a closed sphere is watertight", () => {
    expect(computeTopology(toPositions(sphereTriangles(10))).boundaryEdges).toBe(0);
  });

  it("flags an open mesh", () => {
    const open = boxTriangles(10, 10, 10).slice(2); // remove the bottom face
    const t = computeTopology(toPositions(open));
    expect(t.boundaryEdges).toBe(4);
    expect(inspectModel(toPositions(open)).warnings.map((w) => w.code)).toContain("open-mesh");
  });

  it("flags non-manifold edges", () => {
    const a = boxTriangles(10, 10, 10);
    const b = boxTriangles(10, 10, 10, { x: 10, y: 0, z: 0 }); // shares a full face with a
    const t = computeTopology(toPositions([...a, ...b]));
    expect(t.nonManifoldEdges).toBeGreaterThan(0);
  });

  it("flags zero volume for a flat plane", () => {
    const plane = boxTriangles(10, 10, 10).slice(0, 2);
    expect(inspectModel(toPositions(plane)).warnings.map((w) => w.code)).toContain("zero-volume");
  });

  it("suggests the inches fix for a 2-unit model", () => {
    const r = inspectModel(toPositions(boxTriangles(2, 1.5, 1)));
    expect(r.suggestInches).toBe(true);
    expect(r.warnings.map((w) => w.code)).toContain("likely-inches");
  });

  it("does not suggest inches for a normal-sized model", () => {
    expect(inspectModel(toPositions(boxTriangles(40, 30, 20))).suggestInches).toBe(false);
  });

  it("flags absurdly large models", () => {
    expect(inspectModel(toPositions(boxTriangles(2000, 50, 50))).warnings.map((w) => w.code)).toContain("too-large");
  });
});

describe("inches heuristic boundaries", () => {
  it("leaves a 10 mm calibration cube alone", () => {
    expect(inspectModel(toPositions(boxTriangles(10, 10, 10))).suggestInches).toBe(false);
  });
  it("ignores dust-sized models where ×25.4 is still tiny", () => {
    expect(inspectModel(toPositions(boxTriangles(0.2, 0.2, 0.2))).suggestInches).toBe(false);
  });
});
