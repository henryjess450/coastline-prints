import "server-only";
import { privateSite } from "@config/private.server";
import { site } from "@config/site";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import { shippingBoxesOf, type PackedBox } from "@/lib/shipping/address";
import { MAILER_ID, PARCEL_MAILER_ID } from "@/lib/shipping/pack";

/** Everything one printed label shows. One per package. */
export type LabelData = {
  from: string[];
  /** Name, street lines, then "CITY PROV  POSTAL" (Canada Post wants two spaces before the postal code). */
  to: { name: string; street: string[]; city: string; postal: string };
  phone: string;
  email: string;
  orderNumber: string;
  service: string;
  /** What goes in the postage box: a stamp for Lettermail, nothing to add for prepaid flat rate boxes. */
  postage: string;
  pieces: number;
  pkg: { n: number; of: number; name: string };
  url: string;
};

function service(b: PackedBox) {
  if (b.id === MAILER_ID) return { service: "Oversized Lettermail", postage: "STAMP" };
  if (b.id === PARCEL_MAILER_ID) return { service: "Regular Parcel, tracked", postage: "POSTAGE" };
  return { service: `${b.name} flat rate box, tracked`, postage: "PREPAID" };
}

/** Return address lines, or a loud reminder when SHIP_FROM_ADDRESS isn't set. */
export function returnAddress() {
  const lines = privateSite.returnAddress;
  return lines.length ? [site.name, ...lines] : [site.name, "SET SHIP_FROM_ADDRESS IN .ENV"];
}

export async function loadLabels(orderId: string): Promise<LabelData[] | null> {
  const o = await db.order.findUnique({ where: { id: orderId } });
  if (!o || o.fulfillment !== "SHIP" || !o.shipLine1) return null;
  const boxes = shippingBoxesOf(o);
  const list = boxes.length ? boxes : [{ id: "box", name: "Package", priceCents: 0, pieces: 0 }];
  const from = returnAddress();
  return list.map((b, i) => ({
    from,
    to: {
      name: o.shipName || o.customerName,
      street: [o.shipLine1, o.shipLine2].filter((l): l is string => !!l),
      city: `${o.shipCity ?? ""} ${o.shipProvince ?? ""}`.trim(),
      postal: (o.shipPostal ?? "").toUpperCase(),
    },
    phone: o.customerPhone,
    email: o.customerEmail,
    orderNumber: o.orderNumber,
    ...service(b),
    pieces: b.pieces,
    pkg: { n: i + 1, of: list.length, name: b.name },
    url: `${appUrl()}/orders/${o.viewToken}`,
  }));
}

/** Sample label for the design previews and the alignment test. */
export function sampleLabel(): LabelData {
  return {
    from: returnAddress(),
    to: { name: "Maya Thompson", street: ["3-1420 Lakeshore Rd"], city: "Kelowna BC", postal: "V1W 3J7" },
    phone: "(250) 555-0142",
    email: "maya.t@example.com",
    orderNumber: "CP-10482",
    service: "Oversized Lettermail",
    postage: "STAMP",
    pieces: 3,
    pkg: { n: 1, of: 1, name: "Bubble mailer" },
    url: `${appUrl()}/orders/sample`,
  };
}
