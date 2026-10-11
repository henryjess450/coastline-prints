"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckoutStep } from "@/components/checkout/CheckoutStep";
import type { SquareConfig } from "@/components/checkout/PaymentMethods";
import { buttonClass } from "@/components/ui/Button";
import type { EtransferPublic } from "@/lib/payments/etransfer";
import { useShopCart, useShopCartHydrated, useShopQuote } from "@/lib/shop/cart";
import { PartnerBadge } from "./PartnerBadge";

export function ShopCheckout({ square, etransfer }: { square: SquareConfig | null; etransfer: EtransferPublic }) {
  const router = useRouter();
  const hydrated = useShopCartHydrated();
  const lines = useShopCart((s) => s.lines);
  const setOpen = useShopCart((s) => s.setOpen);
  const quote = useShopQuote(lines);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Checkout</h1>
        <PartnerBadge />
      </div>
      {!hydrated ? (
        <div className="space-y-3" aria-busy>
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-64 w-full" />
        </div>
      ) : !lines.length ? (
        <div className="rounded-3xl border border-line bg-surface px-6 py-16 text-center">
          <p className="font-display text-xl font-semibold">Your cart is empty.</p>
          <Link href="/lightlab#shop" className={buttonClass("primary", "md", "mt-6")}>
            Back to the shop
          </Link>
        </div>
      ) : (
        <>
          {quote.server.status === "error" && (
            <p role="alert" className="mb-6 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
              {quote.server.message}{" "}
              <button type="button" onClick={() => setOpen(true)} className="underline underline-offset-4">
                Open your cart
              </button>
            </p>
          )}
          <CheckoutStep shop={{ lines }} cartQuote={quote} square={square} etransfer={etransfer} onBack={() => (window.history.length > 1 ? router.back() : router.push("/lightlab"))} />
        </>
      )}
    </div>
  );
}
