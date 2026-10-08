import { describeBoxes, MAILER_ID } from "./pack";

/** The shipping fields shared by Checkout and Order rows. */
export type ShipFields = {
  fulfillment: string;
  shipName: string | null;
  shipLine1: string | null;
  shipLine2: string | null;
  shipCity: string | null;
  shipProvince: string | null;
  shipPostal: string | null;
  shippingBoxes: string | null;
};

/** The customer's address as label lines, or null for pickup orders. */
export function shippingAddressLines(o: ShipFields): string[] | null {
  if (o.fulfillment !== "SHIP" || !o.shipLine1) return null;
  return [o.shipName, o.shipLine1, o.shipLine2, `${o.shipCity} ${o.shipProvince}  ${o.shipPostal}`, "Canada"].filter((l): l is string => !!l);
}

export type PackedBox = { id: string; name: string; priceCents: number; pieces: number };

export function shippingBoxesOf(o: ShipFields): PackedBox[] {
  if (o.fulfillment !== "SHIP" || !o.shippingBoxes) return [];
  try {
    return JSON.parse(o.shippingBoxes) as PackedBox[];
  } catch {
    return [];
  }
}

/** False for bubble mailers (Lettermail has no tracking). */
export function isTracked(o: ShipFields) {
  return !shippingBoxesOf(o).some((b) => b.id === MAILER_ID);
}

/** "Canada Post · 1 Medium box" / "Canada Post · Bubble mailer" */
export function shippingSummary(o: ShipFields) {
  const boxes = shippingBoxesOf(o);
  return boxes.length ? `Canada Post · ${describeBoxes(boxes)}` : "Canada Post";
}
