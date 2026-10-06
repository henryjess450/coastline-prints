import { NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/account/auth";
import { walletFor } from "@/lib/account/wallet";

export const runtime = "nodejs";

/** The signed-in customer's saved gift cards and coupons (for one-tap use at checkout). */
export async function GET(req: Request) {
  const customer = await customerFromRequest(req);
  if (!customer) return NextResponse.json({ signedIn: false, items: [] });
  return NextResponse.json({ signedIn: true, email: customer.email, items: await walletFor(customer.id) });
}
