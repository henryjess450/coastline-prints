"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckoutStep } from "@/components/checkout/CheckoutStep";
import type { SquareConfig } from "@/components/checkout/PaymentMethods";
import { Card } from "@/components/ui/Card";
import { ViewerPanel } from "@/components/viewer/ViewerPanel";
import { useDerived } from "@/lib/order/derive";
import { useOrder } from "@/lib/order/store";
import { useCartQuote } from "@/lib/order/use-quote";
import { CartList } from "./CartList";
import { Dropzone } from "./Dropzone";
import { MeshWarnings } from "./MeshWarnings";
import { OptionsPanel } from "./OptionsPanel";
import { PriceSummary } from "./PriceSummary";
import { PrinterCard } from "./PrinterCard";
import { ResizePanel } from "./ResizePanel";
import { Stepper } from "./Stepper";

const stepMotion = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
} as const;

export function OrderWizard({ square }: { square: SquareConfig | null }) {
  const items = useOrder((s) => s.items);
  const selectedKey = useOrder((s) => s.selectedKey);
  const selectedIndex = Math.max(0, items.findIndex((i) => i.key === selectedKey));
  const selected = items[selectedIndex];
  const derived = useDerived(selected);
  const cartQuote = useCartQuote(items);
  const [stage, setStage] = useState<"customize" | "checkout">("customize");
  const step = items.length === 0 ? 0 : stage === "checkout" ? 2 : 1;

  function goTo(next: "customize" | "checkout") {
    setStage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Warn before leaving with files in the cart.
  useEffect(() => {
    if (!items.length) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [items.length]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
      <div className="mx-auto mb-8 max-w-2xl">
        <Stepper current={step} />
      </div>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.section key="upload" {...stepMotion} aria-labelledby="upload-title" className="mx-auto max-w-3xl">
            <h1 id="upload-title" className="mb-2 text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Upload your STL files
            </h1>
            <p className="mb-8 text-center text-muted">You can add up to 10 files. Next you&apos;ll set the size, material and colour for each one.</p>
            <Dropzone />
          </motion.section>
        ) : step === 2 ? (
          <motion.section key="checkout" {...stepMotion} aria-labelledby="checkout-title">
            <h1 id="checkout-title" className="sr-only">
              Checkout
            </h1>
            <CheckoutStep items={items} cartQuote={cartQuote} square={square} onBack={() => goTo("customize")} />
          </motion.section>
        ) : (
          <motion.section key="customize" {...stepMotion} aria-label="Customize your print" className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
              <ViewerPanel item={selected} derived={derived} />
            </div>

            <div className="min-w-0 space-y-4">
              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-fg">Files ({items.length})</h2>
                <CartList />
                <div className="mt-3">
                  <Dropzone compact />
                </div>
              </Card>

              {selected && (
                <AnimatePresence mode="wait">
                  <motion.div key={selected.key} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }} className="space-y-4">
                    <MeshWarnings item={selected} />
                    {derived?.size ? (
                      <>
                        <PrinterCard quote={cartQuote.quote?.items[selectedIndex] ?? null} />
                        <Card className="p-5">
                          <h2 className="mb-4 font-display text-lg font-semibold">Size</h2>
                          <ResizePanel item={selected} derived={derived} />
                        </Card>
                        <Card className="p-5">
                          <h2 className="mb-4 font-display text-lg font-semibold">Material and settings</h2>
                          <OptionsPanel item={selected} />
                        </Card>
                      </>
                    ) : selected.phase !== "error" ? (
                      <Card className="space-y-3 p-5" aria-busy>
                        <div className="skeleton h-5 w-24" />
                        <div className="skeleton h-10 w-full" />
                        <div className="skeleton h-10 w-full" />
                        <div className="skeleton h-24 w-full" />
                      </Card>
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              )}

              <PriceSummary items={items} cartQuote={cartQuote} onCheckout={() => goTo("checkout")} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
