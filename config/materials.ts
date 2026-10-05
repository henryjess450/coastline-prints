/**
 * Materials and their colors. These are the defaults; the admin settings page
 * can override them (stored in the database).
 *
 * - densityGPerCm3: used to turn printed volume into grams.
 * - pricePerGramCents (on a color): optional override of the global
 *   per-gram rate in pricing.ts, for premium spools like wood fill.
 * - finish: drives how the color renders in the 3D preview.
 * - hex: preview color (an approximation of the real spool).
 */
export const MATERIAL_IDS = ["PLA", "PETG", "PLA-CF"] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];

export type ColorFinish = "matte" | "solid" | "silk" | "translucent" | "wood" | "gradient";

export type ColorConfig = {
  id: string;
  name: string;
  hex: string;
  finish: ColorFinish;
  pricePerGramCents?: number;
  available: boolean;
};

export type MaterialConfig = {
  id: MaterialId;
  name: string;
  description: string;
  densityGPerCm3: number;
  colors: ColorConfig[];
};

export const materials: MaterialConfig[] = [
  {
    id: "PLA",
    name: "PLA",
    description: "The standard plastic, with the most colour choices. Good for figures, toys and display pieces.",
    densityGPerCm3: 1.24,
    colors: [
      { id: "red-matte", name: "Red Matte", hex: "#c8322b", finish: "matte", available: true },
      { id: "orange", name: "Orange", hex: "#f2771a", finish: "solid", available: true },
      { id: "yellow", name: "Yellow", hex: "#f5cf1f", finish: "solid", available: true },
      { id: "green", name: "Green", hex: "#2e9e4b", finish: "solid", available: true },
      { id: "aqua", name: "Aqua", hex: "#22c1c3", finish: "solid", available: true },
      { id: "light-blue", name: "Light Blue", hex: "#7cc4f0", finish: "solid", available: true },
      { id: "dark-blue", name: "Dark Blue", hex: "#1f3b8f", finish: "solid", available: true },
      { id: "purple", name: "Purple", hex: "#7b3fb8", finish: "solid", available: true },
      // Wood-fill spools cost $35 to $40 per kg, so this colour carries its own rate.
      { id: "wood", name: "PLA Wood", hex: "#a8773f", finish: "wood", pricePerGramCents: 4, available: true },
      { id: "rainbow-matte", name: "Rainbow Gradient Matte", hex: "#e2479a", finish: "gradient", available: true },
      { id: "peach", name: "Peach", hex: "#f7b38c", finish: "solid", available: true },
      { id: "silk-silver", name: "Silk PLA+ Silver", hex: "#c3c7cc", finish: "silk", available: true },
    ],
  },
  {
    id: "PETG",
    name: "PETG",
    description: "Tougher than PLA and handles more heat, with a little flex. Good for functional parts and see-through pieces.",
    densityGPerCm3: 1.27,
    colors: [
      { id: "tinmorry-transparent-blue", name: "Tinmorry PET-G ECO Transparent Blue", hex: "#2f80d8", finish: "translucent", available: true },
      { id: "tinmorry-transparent-red", name: "Tinmorry PET-G ECO Transparent Red", hex: "#d43a3a", finish: "translucent", available: true },
      { id: "elegoo-translucent-grey", name: "Elegoo PET-G Translucent Grey", hex: "#8b9097", finish: "translucent", available: true },
      { id: "elegoo-translucent-olive", name: "Elegoo PET-G Translucent Olive Green", hex: "#7c8c3b", finish: "translucent", available: true },
      { id: "grey", name: "PET-G Grey", hex: "#7e8389", finish: "solid", available: true },
    ],
  },
  {
    id: "PLA-CF",
    name: "PLA-CF",
    description: "PLA with carbon fibre mixed in. Stiffer, with a matte finish. Printed on the Centauri Carbon because it needs a hardened nozzle.",
    densityGPerCm3: 1.3,
    // Placeholder: no PLA-CF colours were supplied yet. Edit in admin settings.
    colors: [{ id: "black", name: "Carbon Black", hex: "#2a2c30", finish: "matte", available: true }],
  },
];
