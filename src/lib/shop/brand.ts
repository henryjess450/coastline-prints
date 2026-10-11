/** A LightLab order: its items are shop products (orders never mix products and custom prints). */
export function isLightLabOrder(items: { productId: string | null }[]) {
  return items.length > 0 && items.every((i) => !!i.productId);
}
