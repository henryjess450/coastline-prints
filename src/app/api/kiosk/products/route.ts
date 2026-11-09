import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { pairedKiosk } from "@/lib/kiosk/server";
import { listProducts } from "@/lib/shop/products.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the kiosk sells: LightLab's products, minus ones that need a name typed in (those are made to order). */
export async function GET() {
  const kiosk = await pairedKiosk();
  if (!kiosk) return apiError(401, "This kiosk isn't paired.");
  // Order kiosks take everything (it's made later); take-home kiosks skip personalised pieces.
  const all = await listProducts({ shop: "lightlab" });
  const products = kiosk.mode === "order" ? all : all.filter((p) => !p.personalize);
  return NextResponse.json({ products }, { headers: { "Cache-Control": "no-store" } });
}
