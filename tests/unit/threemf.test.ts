import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { decodePaint, parse3mf } from "@/lib/model/threemf";
import { parseModel } from "@/lib/model/parse";
import { computeMeshStats } from "@/lib/stl/analyze";

/** A 10 mm cube (12 triangles) as 3MF mesh XML, optionally painted per triangle. */
function cubeMesh(id: number, paint: (i: number) => string | null = () => null) {
  const v = [
    [0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0],
    [0, 0, 10], [10, 0, 10], [10, 10, 10], [0, 10, 10],
  ];
  const t = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
    [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
  ];
  return `<object id="${id}" type="model"><mesh><vertices>${v.map(([x, y, z]) => `<vertex x="${x}" y="${y}" z="${z}"/>`).join("")}</vertices><triangles>${t
    .map(([a, b, c], i) => `<triangle v1="${a}" v2="${b}" v3="${c}"${paint(i) ? ` paint_color="${paint(i)}"` : ""}/>`)
    .join("")}</triangles></mesh></object>`;
}

function make3mf(model: string, extra: Record<string, string> = {}) {
  const files: Record<string, Uint8Array> = { "3D/3dmodel.model": strToU8(model) };
  for (const [k, v] of Object.entries(extra)) files[k] = strToU8(v);
  return zipSync(files);
}

const wrap = (resources: string, build: string, unit = "millimeter") =>
  `<?xml version="1.0"?><model unit="${unit}" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>${resources}</resources><build>${build}</build></model>`;

describe("3MF reading", () => {
  it("places parts with their component and build transforms", () => {
    const file = make3mf(
      wrap(`${cubeMesh(1)}<object id="2" type="model"><components><component objectid="1" transform="2 0 0 0 2 0 0 0 2 0 0 5"/></components></object>`, `<item objectid="2" transform="1 0 0 0 1 0 0 0 1 100 50 0"/>`),
    );
    const r = parse3mf(file);
    const s = computeMeshStats(r.positions);
    expect(s.bbox.min).toMatchObject({ x: 100, y: 50, z: 5 });
    expect(s.bbox.size).toMatchObject({ x: 20, y: 20, z: 20 });
    expect(s.volumeMm3).toBeCloseTo(8000);
    expect(r.used).toEqual([1]);
  });

  it("converts units and skips non-printable items", () => {
    const file = make3mf(wrap(`${cubeMesh(1)}${cubeMesh(2)}`, `<item objectid="1"/><item objectid="2" printable="0" transform="1 0 0 0 1 0 0 0 1 50 0 0"/>`, "centimeter"));
    expect(computeMeshStats(parse3mf(file).positions).bbox.size.x).toBeCloseTo(100);
  });

  it("reads Bambu paint and part filaments, and the project's filament colours", () => {
    // Top two triangles painted filament 2 ("8"), sides filament 4 ("1C"), the rest unpainted.
    const paint = (i: number) => (i === 2 || i === 3 ? "8" : i >= 4 && i < 6 ? "1C" : null);
    const file = make3mf(wrap(`${cubeMesh(1, paint)}<object id="2" type="model"><components><component objectid="1"/></components></object>`, `<item objectid="2"/>`), {
      "Metadata/model_settings.config": `<config><object id="2"><metadata key="extruder" value="1"/><part id="1" subtype="normal_part"><metadata key="extruder" value="3"/></part></object></config>`,
      "Metadata/project_settings.config": JSON.stringify({ filament_colour: ["#de4343", "#FFFFFF", "#000000", "#3F8E43"], filament_type: ["PLA", "PLA", "PETG", "PLA"] }),
    });
    const r = parse3mf(file);
    const count = (f: number) => r.triColors.filter((c) => c === f).length;
    expect([count(2), count(4), count(3)]).toEqual([2, 2, 8]); // unpainted use the part's filament 3
    expect(r.used).toEqual([2, 3, 4]);
    expect(r.filaments[0]).toEqual({ hex: "#DE4343", type: "PLA" });
    expect(r.filaments[2].type).toBe("PETG");
    // Mesh checks use the unsplit triangles, so paint splits never look like holes.
    expect(r.basePositions.length).toBe(12 * 9);
  });

  it("uses only plate 1 of a multi-plate project and says so", () => {
    const file = make3mf(wrap(`${cubeMesh(1)}${cubeMesh(2)}`, `<item objectid="1"/><item objectid="2" transform="1 0 0 0 1 0 0 0 1 300 0 0"/>`), {
      "Metadata/model_settings.config": `<config><plate><metadata key="object_id" value="1"/></plate><plate><metadata key="object_id" value="2"/></plate></config>`,
    });
    const r = parse3mf(file);
    expect(computeMeshStats(r.positions).bbox.size.x).toBeCloseTo(10);
    expect(r.notes[0]).toMatch(/2 plates/);
  });

  it("is picked by content in parseModel, and rejects junk", () => {
    expect(parseModel(make3mf(wrap(cubeMesh(1), `<item objectid="1"/>`))).format).toBe("3mf");
    expect(() => parseModel(strToU8("hello"))).toThrow(/STL or 3MF/);
    expect(() => parseModel(zipSync({ "readme.txt": strToU8("hi") }))).toThrow(/no 3D model/);
  });
});

describe("paint decoding (Bambu/Prusa TriangleSelector format)", () => {
  const A: [number, number, number] = [0, 0, 0];
  const B: [number, number, number] = [4, 0, 0];
  const C: [number, number, number] = [0, 4, 0];
  const leaves = (code: string) => {
    const out: { state: number; pts: number[][] }[] = [];
    decodePaint(code, A, B, C, (a, b, c, state) => out.push({ state, pts: [a, b, c] }));
    return out;
  };
  const area = (p: number[][]) => Math.abs((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1])) / 2;

  it("reads simple and extended states", () => {
    expect(leaves("4")[0].state).toBe(1);
    expect(leaves("8")[0].state).toBe(2);
    expect(leaves("0C")[0].state).toBe(3);
    expect(leaves("1C")[0].state).toBe(4);
    expect(leaves("F0FC")[0].state).toBe(0 + 15 + 3); // "C" = extended, one "F" run adds 15, then 0
  });

  it("splits a triangle into halves, thirds and quarters that cover it exactly", () => {
    // One split on special side 0: children stored last first, so "1" then child 1 (state 1) then child 0 (state 2): "841".
    const one = leaves("841");
    expect(one.map((l) => l.state)).toEqual([1, 2]);
    expect(one[1].pts).toEqual([A, B, [2, 2, 0]]); // child 0 = (p0, p1, mid(p2, p1))
    // Three-way split: every child painted filament 2.
    const four = leaves("88883");
    expect(four).toHaveLength(4);
    expect(four.reduce((s, l) => s + area(l.pts), 0)).toBeCloseTo(8);
    // Two-way split with a nested one-way split inside.
    const nested = leaves("8" + "4" + "841" + "2");
    expect(nested.reduce((s, l) => s + area(l.pts), 0)).toBeCloseTo(8);
  });

  it("falls back to unpainted on damaged codes", () => {
    expect(leaves("Z")[0].state).toBe(0);
    expect(leaves("3")[0].state).toBe(0); // split with no children data
  });
});
