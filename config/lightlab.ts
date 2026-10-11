/**
 * LightLab | Victoria: a 3D printed lighting shop sold through this site at
 * /lightlab, with products edited at /lightlab/admin. Orders use the normal
 * checkout and show up in the Coastline admin like any other order.
 */
export const lightlab = {
  id: "lightlab",
  name: "LightLab | Victoria",
  shortName: "LightLab",
  /** Drop the logo file in public/brand/ with this name. Until then the name shows as text. */
  logoSrc: "/brand/lightlab-logo.png",
  /** Optional light-on-dark version for dark mode. Falls back to logoSrc. */
  logoDarkSrc: "/brand/lightlab-logo-dark.png",
  partnerLine: "Coastline Prints is the Preferred 3D Printing Partner of LightLab | Victoria",
  /** Shown as the "material" and "printer" on order items, receipts and the admin. */
  itemMaterial: "LightLab",
  itemPrinter: "LightLab | Victoria (in stock)",
  /** Most of one product in one order. */
  maxQuantityPerLine: 20,
  maxLinesPerOrder: 20,
  maxImagesPerProduct: 8,
  maxImageMb: 8,
} as const;
