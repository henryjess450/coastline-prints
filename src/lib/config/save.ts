import "server-only";
import { db } from "@/lib/db";
import { materialsSchema, pricingSchema } from "./schema";

export async function savePricing(input: unknown) {
  const value = pricingSchema.parse(input);
  await db.setting.upsert({ where: { key: "pricing" }, create: { key: "pricing", value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  return value;
}

export async function saveMaterials(input: unknown) {
  const value = materialsSchema.parse(input);
  for (const m of value) {
    const ids = m.colors.map((c) => c.id);
    if (new Set(ids).size !== ids.length) throw new Error(`${m.name} has two colours with the same id.`);
    if (!m.colors.some((c) => c.available)) throw new Error(`${m.name} needs at least one available colour.`);
  }
  await db.setting.upsert({ where: { key: "materials" }, create: { key: "materials", value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  return value;
}

/** Back to the defaults in config/*.ts. */
export async function resetSetting(key: "pricing" | "materials") {
  await db.setting.deleteMany({ where: { key } });
}
