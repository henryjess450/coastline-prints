import { lightlab } from "./lightlab";

/**
 * The product shops on this site. Both use the same products table, cart,
 * checkout and admin editor; this is what differs between them.
 * - lightlab: LightLab | Victoria lamps at /lightlab (black and white pages, LL- orders).
 * - coastline: Coastline Prints' ready-made prints at /shop (no file needed, CP- orders).
 */
export const SHOP_IDS = ["lightlab", "coastline"] as const;
export type ShopId = (typeof SHOP_IDS)[number];

type ShopConfig = {
  id: ShopId;
  name: string;
  /** Where the shop lives, and its product pages under it. */
  base: string;
  /** Where its products are edited. */
  admin: string;
  orderPrefix: "LL" | "CP";
  /** Shown as the "material" and "printer" on order items, receipts and the admin. */
  itemMaterial: string;
  itemPrinter: string;
  /** Stored as the order item's printer id; how an order is known to be from this shop. */
  itemPrinterId: string;
  maxQuantityPerLine: number;
  maxLinesPerOrder: number;
  maxImagesPerProduct: number;
  maxImageMb: number;
  lowStockAt: number;
};

export const shops: Record<ShopId, ShopConfig> = {
  lightlab: {
    id: "lightlab",
    name: lightlab.name,
    base: "/lightlab",
    admin: "/lightlab/admin",
    orderPrefix: "LL",
    itemMaterial: lightlab.itemMaterial,
    itemPrinter: lightlab.itemPrinter,
    itemPrinterId: lightlab.id,
    maxQuantityPerLine: lightlab.maxQuantityPerLine,
    maxLinesPerOrder: lightlab.maxLinesPerOrder,
    maxImagesPerProduct: lightlab.maxImagesPerProduct,
    maxImageMb: lightlab.maxImageMb,
    lowStockAt: lightlab.lowStockAt,
  },
  coastline: {
    id: "coastline",
    name: "Coastline Prints shop",
    base: "/shop",
    admin: "/admin/shop",
    orderPrefix: "CP",
    itemMaterial: "Ready-made",
    itemPrinter: "Shop (ready-made)",
    itemPrinterId: "coastline-shop",
    maxQuantityPerLine: 20,
    maxLinesPerOrder: 20,
    maxImagesPerProduct: 8,
    maxImageMb: 8,
    lowStockAt: 2,
  },
};

export const shopConfig = (id: string | null | undefined) => shops[id === "coastline" ? "coastline" : "lightlab"];
