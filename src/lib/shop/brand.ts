/**
 * A LightLab order: every item is a LightLab product. Coastline shop products
 * are told apart by the printer id stored on the item (config/shops.ts);
 * older LightLab items carry "lightlab" there too. Custom lines rung up at
 * the LightLab register have no product but carry the same printer id.
 */
export function isLightLabOrder(items: { productId: string | null; printerId?: string | null }[]) {
  return items.length > 0 && items.every((i) => (i.printerId == null ? !!i.productId : i.printerId === "lightlab"));
}
