"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckoutStep } from "@/components/checkout/CheckoutStep";
import type { SquareConfig } from "@/components/checkout/PaymentMethods";
import { HeroWater, type Tow } from "@/components/home/HeroWater";
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
  const selectedIndex = Math.max(
    0,
    items.findIndex((i) => i.key === selectedKey),
  );
  const selected = items[selectedIndex];
  const derived = useDerived(selected);
  const cartQuote = useCartQuote(items);
  const [stage, setStage] = useState<"customize" | "checkout">("customize");
  const step = items.length === 0 ? 0 : stage === "checkout" ? 2 : 1;

  function goTo(next: "customize" | "checkout") {
    setStage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // The Benchy tows the upload box in on a rope, then lets go.
  const root = useRef<HTMLDivElement>(null);
  const towed = useRef<HTMLDivElement>(null);
  const rope = useRef<SVGPathElement>(null);
  const towing = useRef(false);
  useLayoutEffect(() => {
    const box = towed.current;
    if (!box || items.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Start off screen to the left; onTow pulls it in.
    towing.current = true;
    box.style.transform = "translateX(-120vw)";
    // If the animation can't run (hidden tab, slow device), don't leave the box stranded.
    const t = window.setTimeout(() => {
      box.style.transform = "";
      rope.current?.style.setProperty("opacity", "0");
    }, 8000);
    return () => window.clearTimeout(t);
    // Only on first arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onTow = useCallback((t: Tow) => {
    const box = towed.current;
    const line = rope.current;
    const r = root.current?.getBoundingClientRect();
    if (!box || !line || !r || !towing.current) return;
    box.style.transform = t.p >= 1 ? "" : `translateX(${t.dx.toFixed(1)}px)`;
    // Rope from the stern to the box's right edge, sagging less as it tightens.
    const b = box.getBoundingClientRect();
    const ax = b.right - r.left - 6;
    const ay = b.bottom - r.top - 48;
    const sx = t.sternX - r.left;
    const sy = t.sternY - r.top;
    const sag = Math.min(70, Math.hypot(sx - ax, sy - ay) * 0.12) * (1 - t.p * 0.6);
    line.setAttribute("d", `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${((sx + ax) / 2).toFixed(1)} ${(Math.max(sy, ay) + sag).toFixed(1)} ${ax.toFixed(1)} ${ay.toFixed(1)}`);
    line.style.opacity = t.p >= 1 ? "0" : "1";
    if (t.p >= 1) towing.current = false;
  }, []);

  // Warn before leaving with files in the cart.
  useEffect(() => {
    if (!items.length) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [items.length]);

  return (
    <div ref={root} className="relative isolate">
      {/* Tow rope, drawn over the water but under the content */}
      <svg className="pointer-events-none absolute inset-0 -z-[5] h-full w-full overflow-visible" aria-hidden>
        <path ref={rope} fill="none" stroke="#c9a26a" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0, transition: "opacity 1.2s ease" }} />
      </svg>
      {/* Calm water along the bottom of the upload step, like the home page */}
      <AnimatePresence>
        {step === 0 && (
          <motion.div
            key="water"
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[30rem]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <HeroWater surface={{ wide: 0.45, narrow: 0.55 }} boatAt={{ wide: 0.86, narrow: 0.78 }} boatSize={0.8} enter onTow={onTow} sun={false} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <div className="mx-auto mb-12 max-w-2xl sm:mb-16">
          <Stepper current={step} />
        </div>

        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.section key="upload" {...stepMotion} aria-labelledby="upload-title" className="mx-auto max-w-3xl pb-48 sm:pb-56">
              <h1 id="upload-title" className="mb-4 text-center font-display text-4xl font-bold tracking-tight sm:text-5xl">
                Upload your STL files
              </h1>
              <p className="mb-12 text-center leading-relaxed text-muted">You can add up to 10 files. Next you&apos;ll set the size, material and colour for each one.</p>
              <div ref={towed} className="will-change-transform">
                <Dropzone />
              </div>
              <p className="mt-6 text-center text-sm text-muted">
                Don&apos;t have a file?{" "}
                <a href="/library" className="text-accent-text underline underline-offset-4">
                  Search for a model
                </a>
              </p>
            </motion.section>
          ) : step === 2 ? (
            <motion.section key="checkout" {...stepMotion} aria-labelledby="checkout-title">
              <h1 id="checkout-title" className="sr-only">
                Checkout
              </h1>
              <CheckoutStep items={items} cartQuote={cartQuote} square={square} onBack={() => goTo("customize")} />
            </motion.section>
          ) : (
            <motion.section
              key="customize"
              {...stepMotion}
              aria-label="Customize your print"
              className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-10"
            >
              <div className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
                <ViewerPanel item={selected} derived={derived} />
              </div>

              <div className="min-w-0 space-y-6">
                <Card flat className="p-6">
                  <h2 className="mb-4 font-display text-lg font-semibold">Files ({items.length})</h2>
                  <CartList />
                  <div className="mt-4">
                    <Dropzone compact />
                  </div>
                </Card>

                {selected && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selected.key}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.22 }}
                      className="space-y-6"
                    >
                      <MeshWarnings item={selected} />
                      {derived?.size ? (
                        <>
                          <PrinterCard quote={cartQuote.quote?.items[selectedIndex] ?? null} />
                          <Card flat className="p-6 sm:p-8">
                            <h2 className="mb-5 font-display text-lg font-semibold">Size</h2>
                            <ResizePanel item={selected} derived={derived} />
                          </Card>
                          <Card flat className="p-6 sm:p-8">
                            <h2 className="mb-5 font-display text-lg font-semibold">Material and settings</h2>
                            <OptionsPanel item={selected} />
                          </Card>
                        </>
                      ) : selected.phase !== "error" ? (
                        <Card flat className="space-y-3 p-6" aria-busy>
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
    </div>
  );
}
