import { describe, expect, it } from "vitest";
import type { PrinterConfig } from "@config/printers";
import { defaultConfig } from "@/lib/config/types";
import { assignPrinter, findFittingOrientation, maxUniformScale, orientDims, orientationMatrix, type OrientationIndex } from "@/lib/printers/fit";

const cfg = defaultConfig();
const fleet = cfg.printers;
const M = cfg.safetyMarginMm; // 5 mm → A1 Mini usable 175, Centauri 251
const box = (x: number, y: number, z: number) => ({ x, y, z });

describe("printer assignment", () => {
  it("prefers the A1 Mini for PLA that fits", () => {
    const a = assignPrinter(box(50, 50, 50), "PLA", fleet, M);
    expect(a.ok && a.printer.id).toBe("a1-mini");
  });

  it("uses the Centauri Carbon when the A1 Mini is too small", () => {
    const a = assignPrinter(box(200, 50, 50), "PETG", fleet, M);
    expect(a.ok && a.printer.id).toBe("centauri-carbon");
  });

  it("always routes PLA-CF to the Centauri Carbon, even tiny parts", () => {
    const a = assignPrinter(box(10, 10, 10), "PLA-CF", fleet, M);
    expect(a.ok && a.printer.id).toBe("centauri-carbon");
  });

  it("routes PLA-CF to the A1 Mini once its material list allows it", () => {
    const hardened = fleet.map((p) => (p.id === "a1-mini" ? { ...p, materials: [...p.materials, "PLA-CF" as const] } : p));
    const a = assignPrinter(box(10, 10, 10), "PLA-CF", hardened, M);
    expect(a.ok && a.printer.id).toBe("a1-mini");
  });

  describe("exact build limits (usable = bed − 5 mm)", () => {
    it("fits the A1 Mini at exactly 175 mm", () => {
      const a = assignPrinter(box(175, 175, 175), "PLA", fleet, M);
      expect(a.ok && a.printer.id).toBe("a1-mini");
    });
    it("moves to the Centauri at 175.01 mm", () => {
      const a = assignPrinter(box(175.01, 100, 100), "PLA", fleet, M);
      expect(a.ok && a.printer.id).toBe("centauri-carbon");
    });
    it("fits the Centauri at exactly 251 mm", () => {
      expect(assignPrinter(box(251, 251, 251), "PLA", fleet, M).ok).toBe(true);
    });
    it("fits nothing at 251.01 mm and offers a scale-down", () => {
      const a = assignPrinter(box(251.01, 10, 10), "PLA", fleet, M);
      expect(a.ok).toBe(false);
      if (!a.ok) {
        expect(a.reason).toBe("too-large");
        expect(a.largest?.id).toBe("centauri-carbon");
        expect(a.maxScale).toBeCloseTo(251 / 251.01, 6);
      }
    });
    it("respects a different safety margin", () => {
      const a = assignPrinter(box(178, 50, 50), "PLA", fleet, 2);
      expect(a.ok && a.printer.id).toBe("a1-mini");
    });
  });

  it("reports when no printer supports the material", () => {
    const a = assignPrinter(box(10, 10, 10), "PLA-CF", fleet.filter((p) => p.id === "a1-mini"), M);
    expect(!a.ok && a.reason).toBe("material");
  });
});

describe("orientation", () => {
  const tall: PrinterConfig = { id: "tall", name: "Tall", shortName: "Tall", buildVolume: { x: 105, y: 105, z: 305 }, materials: ["PLA"], speedFactor: 1, priority: 1 };

  it("keeps the customer's orientation when it fits", () => {
    const a = assignPrinter(box(50, 60, 70), "PLA", [tall], M);
    expect(a.ok && a.orientation).toBe(0);
    expect(a.ok && a.autoOriented).toBe(false);
  });

  it("auto-orients a long part to stand up on a tall printer", () => {
    const a = assignPrinter(box(250, 40, 30), "PLA", [tall], M);
    expect(a.ok).toBe(true);
    if (a.ok) {
      expect(a.autoOriented).toBe(true);
      expect(a.orientedSize.z).toBe(250);
    }
  });

  it("chooses the lowest fitting height among alternatives", () => {
    const o = findFittingOrientation(box(300, 50, 10), box(305, 305, 100));
    expect(o).not.toBeNull();
    expect(orientDims(box(300, 50, 10), o!).z).toBe(10);
  });

  it("all 6 orientations are proper rotations (det = +1)", () => {
    for (let i = 0; i < 6; i++) {
      const m = orientationMatrix(i as OrientationIndex);
      const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
      expect(det).toBe(1);
    }
  });

  it("max uniform scale considers rotation", () => {
    // 300×10×10 can't fit 251 in any axis, so the best scale is 251/300.
    expect(maxUniformScale(box(300, 10, 10), box(251, 251, 251))).toBeCloseTo(251 / 300, 9);
    // On the tall printer it can stand up: 300 → 300 of 300 usable.
    expect(maxUniformScale(box(300, 10, 10), box(100, 100, 300))).toBeCloseTo(1, 9);
  });
});
