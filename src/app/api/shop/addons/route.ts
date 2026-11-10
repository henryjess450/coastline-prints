import { NextResponse } from "next/server";
import { SHOP_IDS, type ShopId } from "@config/shops";
import { listProducts } from "@/lib/shop/products.server";
import { notDropped } from "@/lib/shop/types";

export const runtime = "nodejs";

/** A shop's add-ons (spare bulbs, smart bulbs...), for the one-tap extras in the cart. */
export async function GET(req: Request) {
  const want = new URL(req.url).searchParams.get("shop") ?? "lightlab";
  const shop = (SHOP_IDS as readonly string[]).includes(want) ? (want as ShopId) : "lightlab";
  const addons = (await listProducts({ shop })).filter((p) => p.addon && !notDropped(p));
  return NextResponse.json({ addons }, { headers: { "Cache-Control": "no-store" } });
}
