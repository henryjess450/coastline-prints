import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, logError } from "@/lib/api";
import { cancelKioskSale, checkKioskSale, kioskCartSchema, kioskCustomerSchema, pairedKiosk, startKioskSale } from "@/lib/kiosk/server";
import { PosSaleError } from "@/lib/pos/sale.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const start = z.object({ cart: kioskCartSchema, customer: kioskCustomerSchema });
const saleId = (req: Request) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return /^[0-9a-f-]{36}$/.test(id) ? id : null;
};

/** Start paying: the server prices the cart and makes the Square QR link. */
export async function POST(req: Request) {
  const kiosk = await pairedKiosk();
  if (!kiosk) return apiError(401, "This kiosk isn't paired.");
  const parsed = start.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Check the details.");
  try {
    return NextResponse.json(await startKioskSale(kiosk.id, parsed.data.cart, parsed.data.customer));
  } catch (err) {
    if (err instanceof PosSaleError) return apiError(409, err.message);
    logError("kiosk:start", err);
    return apiError(502, "Couldn't start the payment. Please try again, or pay at the stand.");
  }
}

/** Has it been paid? (Rings the sale up when it has.) */
export async function GET(req: Request) {
  const kiosk = await pairedKiosk();
  if (!kiosk) return apiError(401, "This kiosk isn't paired.");
  const id = saleId(req);
  if (!id) return apiError(400, "Missing sale.");
  try {
    const sale = await checkKioskSale(kiosk.id, id);
    return sale ? NextResponse.json(sale, { headers: { "Cache-Control": "no-store" } }) : apiError(404, "No such sale.");
  } catch (err) {
    logError("kiosk:check", err);
    return apiError(502, "Couldn't check with Square.");
  }
}

/** The shopper went back or walked away. */
export async function DELETE(req: Request) {
  const kiosk = await pairedKiosk();
  if (!kiosk) return apiError(401, "This kiosk isn't paired.");
  const id = saleId(req);
  if (id) await cancelKioskSale(kiosk.id, id).catch((e) => logError("kiosk:cancel", e));
  return NextResponse.json({ ok: true });
}
