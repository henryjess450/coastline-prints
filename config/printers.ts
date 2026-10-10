/**
 * Printer fleet. Add a printer by appending to `printers`.
 *
 * - buildVolume: usable bed size in mm (before the safety margin).
 * - materials: what this printer is allowed to run. PLA-CF needs a hardened
 *   nozzle. Add "PLA-CF" to the A1 Mini here if you fit one.
 * - speedFactor: relative throughput vs. the reference print-time model in
 *   pricing.ts (1.0 = reference, 1.2 = 20% faster).
 * - priority: lower is tried first when several printers can take a job.
 * - maxColors: how many filaments it can switch between in one print (1 = no
 *   multicolour unit). Both have a 4-colour unit.
 */
import type { MaterialId } from "./materials";

export type PrinterConfig = {
  id: string;
  name: string;
  shortName: string;
  buildVolume: { x: number; y: number; z: number };
  materials: MaterialId[];
  speedFactor: number;
  priority: number;
  maxColors: number;
};

export const printers: PrinterConfig[] = [
  {
    id: "a1-mini",
    name: "Bambu Lab A1 Mini",
    shortName: "A1 Mini",
    buildVolume: { x: 180, y: 180, z: 180 },
    materials: ["PLA", "PETG"],
    speedFactor: 1.0,
    priority: 1,
    maxColors: 4,
  },
  {
    id: "centauri-carbon",
    name: "Elegoo Centauri Carbon",
    shortName: "Centauri Carbon",
    buildVolume: { x: 256, y: 256, z: 256 },
    materials: ["PLA", "PETG", "PLA-CF"],
    speedFactor: 1.2,
    priority: 2,
    maxColors: 4,
  },
];

/** Clearance kept free on every axis (mm), so a 180 mm bed accepts up to 175 mm. */
export const SAFETY_MARGIN_MM = 5;
