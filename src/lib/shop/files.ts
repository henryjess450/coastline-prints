/** The owner's own print files kept with shop products. Admin only. */
export const productFiles = {
  /** Per file. Big multi-plate 3MF projects can be large. */
  maxMb: 300,
  extensions: ["stl", "3mf", "obj", "step", "stp", "f3d", "blend", "gcode", "zip"],
};

export const fileExt = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

export function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export type ProductFileDto = { id: string; fileName: string; sizeBytes: number; createdAt: string };
