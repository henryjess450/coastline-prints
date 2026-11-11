"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { shopConfig } from "@config/shops";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { cartFor } from "@/lib/shop/cart";
import { CUSTOM_TEXT_MAX, editionLeft, inStock, notDropped, photosFor, slugify, unitPrice, variantForPhoto, variantOf, type ShopProductDto } from "@/lib/shop/types";
import { DropCountdown } from "./DropCountdown";
import { atStand, standLeft, standPool, type StandDto } from "@/lib/shop/stand";
import { StandHoldForm } from "./StandHoldForm";
import { clock } from "@/lib/shop/markets";
import { buzz, play } from "@/lib/feel";
import { flyToCart } from "@/lib/feel/fly";
import { Gallery } from "./Gallery";
import { QuantityStepper } from "./QuantityStepper";
import { RestockForm } from "./RestockForm";

/** Photos, options, personalisation, quantity and "Add to cart" for one product (either shop). */
export function ProductBuy({ product: p, ships = true, initialVariant = null, stand = null }: { product: ShopProductDto; /** False while the shop is pickup only. */ ships?: boolean; /** From a ?colour= link. */ initialVariant?: string | null; /** LightLab: lamps packed for today's (or tomorrow's) market. */ stand?: StandDto | null }) {
  const shop = shopConfig(p.shop);
  const ll = shop.id === "lightlab";
  const useCart = cartFor(shop.id);
  const [customText, setCustomText] = useState("");
  const [needText, setNeedText] = useState(false);
  // Start on the option a ?colour= link names, else the first one that's in stock.
  const [variantId, setVariantState] = useState<string | null>(() => initialVariant ?? p.variants.find((v) => inStock(p, v.id) !== 0)?.id ?? p.variants[0]?.id ?? null);
  // Keep ?colour= in the address bar so the chosen option (and its photo) can be shared.
  function setVariantId(id: string) {
    setVariantState(id);
    const v = variantOf(p, id);
    if (!v) return;
    const url = new URL(window.location.href);
    url.searchParams.set("colour", slugify(v.name));
    window.history.replaceState(window.history.state, "", url);
  }
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);
  const photoRef = useRef<HTMLDivElement>(null);
  // The button shows a tick for a moment after adding.
  const [justAdded, setJustAdded] = useState(false);
  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), 1400);
    return () => clearTimeout(t);
  }, [justAdded]);
  const text = customText.trim();
  const inCart = useCart((s) => s.lines.find((l) => l.productId === p.id && l.variantId === variantId && (l.customText ?? "") === (p.personalize ? text : ""))?.quantity ?? 0);
  const [added, setAdded] = useState(0);

  const variant = variantOf(p, variantId);
  const photos = photosFor(p, variantId);
  const cover = photos.images[0] ?? null;
  const price = unitPrice(p, variantId);
  const left = inStock(p, variantId);
  const canAdd = left == null ? shop.maxQuantityPerLine - inCart : Math.min(left, shop.maxQuantityPerLine) - inCart;
  const soldOut = left === 0;
  // A drop still to come: counts down, then opens without a reload.
  const [upcoming, setUpcoming] = useState(() => notDropped(p));
  const runLeft = editionLeft(p);
  const quantity = Math.max(1, Math.min(qty, canAdd));

  function addToCart() {
    if (canAdd <= 0) return;
    if (p.personalize && !text) {
      setNeedText(true);
      document.getElementById("ll-custom-text")?.focus();
      return;
    }
    const line = { productId: p.id, variantId, quantity, customText: p.personalize ? text : null, slug: p.slug, name: p.name, variantName: variant?.name ?? null, swatch: variant?.hex ?? null, image: cover, unitCents: price, max: left };
    play("pop");
    buzz();
    setJustAdded(true);
    setAdded((n) => n + 1);
    setQty(1);
    // The photo flies into the cart first; the drawer opens when it lands.
    flyToCart(photoRef.current, cover, () => add(line));
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
      <div ref={photoRef} className="min-w-0">
        <Gallery
          images={photos.images}
          name={p.name}
          shop={shop.id}
          glow={variant?.hex ?? null}
          tag={p.personalize ? text || null : null}
          note={photos.picturedIn && variant ? `Pictured in ${photos.picturedIn.name}` : null}
          // Tapping a photo of one option picks that option.
          onPick={(src) => {
            const v = variantForPhoto(p, src);
            if (v && v.id !== variantId) setVariantId(v.id);
          }}
        />
      </div>

      <div className="min-w-0 lg:pt-4">
        {p.category && <p className={ll ? "ll-accent text-2xl" : "text-xs font-semibold uppercase tracking-[0.14em] text-accent-text"}>{p.category}</p>}
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{p.name}</h1>
        {p.tagline && <p className={ll ? "ll-accent mt-2 text-3xl" : "mt-2 text-lg text-muted"}>{p.tagline}</p>}
        <p className="mt-5 flex items-baseline gap-3">
          <motion.span key={price} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-3xl font-bold tabular-nums">
            {money(price)}
          </motion.span>
          {p.compareAtCents && p.compareAtCents > price && <span className="font-mono text-faint line-through">{money(p.compareAtCents)}</span>}
        </p>

        {p.variants.length > 0 && (
          <fieldset className="mt-8">
            <legend className="mb-3 text-sm font-medium">
              Option{variant && <span className="font-normal text-muted">: {variant.name}</span>}
            </legend>
            <div className="flex flex-wrap gap-2">
              {p.variants.map((v) => {
                const on = v.id === variantId;
                const out = inStock(p, v.id) === 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    aria-pressed={on}
                    className={cn("relative inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-[border-color,transform] active:scale-95", on ? "border-accent-line" : "border-line hover:border-accent-line", out && "text-faint line-through")}
                  >
                    {on && <motion.span layoutId={`ll-variant-${p.id}`} className="absolute -inset-px rounded-full border-2 border-accent-line bg-accent-soft" transition={{ type: "spring", stiffness: 460, damping: 34 }} />}
                    {v.hex && <span className="relative h-4 w-4 rounded-full border border-line-strong" style={{ background: v.hex }} aria-hidden />}
                    <span className="relative">{v.name}</span>
                    {v.priceCents != null && v.priceCents !== p.priceCents && <span className="relative font-mono text-xs text-muted">{money(v.priceCents)}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {p.personalize && (
          <div className="mt-8 max-w-sm">
            <label htmlFor="ll-custom-text" className="mb-2 block text-sm font-medium">
              {p.personalize}
            </label>
            <input
              id="ll-custom-text"
              value={customText}
              maxLength={CUSTOM_TEXT_MAX}
              onChange={(e) => (setCustomText(e.target.value), setNeedText(false))}
              aria-invalid={needText}
              className={cn("h-11 w-full rounded-xl border bg-surface px-3.5 text-sm outline-none transition-[border-color,box-shadow] focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]", needText ? "border-danger/60" : "border-line")}
            />
            <p className={cn("mt-1.5 text-xs", needText ? "text-danger" : "text-faint")} role={needText ? "alert" : undefined}>
              {needText ? "Please fill this in first." : `Up to ${CUSTOM_TEXT_MAX} characters. Printed exactly as typed.`}
            </p>
          </div>
        )}

        {p.editionSize != null && (
          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-line px-4 py-2 text-sm">
            <span className="font-semibold">Limited run of {p.editionSize}</span>
            <span className="text-muted">{runLeft === 0 ? "All gone" : upcoming ? "Each one numbered" : `${runLeft} left · yours will be No. ${p.editionSold + 1}`}</span>
          </div>
        )}

        {upcoming && p.dropAt ? (
          <DropCountdown at={p.dropAt} onDropped={() => setUpcoming(false)} />
        ) : (
          <p className={cn("mt-6 text-sm", soldOut ? "text-danger" : left != null && left <= 3 ? "text-warning" : "text-success")}>
            {soldOut ? (runLeft === 0 ? "Sold out: every number is taken" : "Sold out") : left == null ? "Made to order" : left <= 3 ? `Only ${left} left` : "In stock"}
          </p>
        )}

        {ll && atStand(stand, p.id) && !upcoming && <AtStand stand={stand!} productId={p.id} variantId={variantId} label={variant ? `${p.name} (${variant.name})` : p.name} left={standLeft(stand, p.id, variantId)} optionName={variant && standPool(stand!, p.id, variant.id) !== `${p.id}:` ? variant.name : null} notHere={variant && !(standPool(stand!, p.id, variant.id) in stand!.left) ? variant.name : null} />}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {upcoming ? (
            <RestockForm productId={p.id} variantId={null} label={p.name} drop />
          ) : soldOut && !ll ? null : soldOut ? (
            // Keyed so switching options starts a fresh form.
            <RestockForm key={variantId ?? ""} productId={p.id} variantId={variantId} label={variant ? `${p.name} (${variant.name})` : p.name} />
          ) : (
            <>
              {canAdd > 0 && <QuantityStepper value={quantity} max={canAdd} onChange={setQty} />}
              <Button size="lg" className="min-w-48 flex-1 sm:flex-none" onClick={addToCart} disabled={canAdd <= 0 && !justAdded}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={justAdded ? "tick" : "label"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="inline-flex items-center gap-2">
                    {justAdded ? (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, ease: "easeOut" }} />
                        </svg>
                        Added
                      </>
                    ) : canAdd <= 0 ? (
                      "All in your cart"
                    ) : (
                      `Add to cart · ${money(price * quantity)}`
                    )}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </>
          )}
        </div>
        <AnimatePresence>
          {added > 0 && (
            <motion.p key={added} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-sm text-success" role="status">
              Added to your cart.
            </motion.p>
          )}
        </AnimatePresence>

        {p.description && <div className="mt-10 whitespace-pre-line border-t border-line pt-8 leading-relaxed text-muted">{p.description}</div>}

        <ul className="mt-8 space-y-2 border-t border-line pt-6 text-sm text-muted">
          <li>{ships ? "Free pickup, or Canada Post shipping anywhere in Canada." : "Free pickup in Victoria."}</li>
          <li>Pay by Interac e-Transfer or card. {ll ? "Coastline gift cards work too." : "Gift cards work too."}</li>
        </ul>
      </div>
    </div>
  );
}

/** "At the stand at Moss Street today": how many are there, and hold one for free to pay at the stand. */
function AtStand({ stand, productId, variantId, label, left, optionName, notHere }: { stand: StandDto; productId: string; variantId: string | null; label: string; left: number; optionName: string | null; /** The chosen option wasn't packed (others were). */ notHere: string | null }) {
  const when = stand.when === "today" ? `today until ${clock(stand.endTime)}` : `tomorrow, ${clock(stand.startTime)} to ${clock(stand.endTime)}`;
  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="h-2.5 w-2.5 rounded-full bg-[#297f9d]" aria-hidden />
        At the LightLab stand at {stand.name} {when}
      </p>
      <p className="mt-1 text-sm text-muted">
        {stand.place}.{" "}
        {left > 0 ? `${left} ${optionName ? `in ${optionName} ` : ""}${left === 1 ? "is" : "are"} there.` : notHere ? `${notHere} isn't at the stand, but other options are.` : "The ones at the stand are all held right now."}
      </p>
      {left > 0 && (stand.reservable ? <StandHoldForm key={`${productId}:${variantId ?? ""}`} stand={stand} productId={productId} variantId={variantId} label={label} max={Math.min(5, left)} /> : <p className="mt-3 text-sm">Come by before {clock(stand.endTime)}!</p>)}
    </div>
  );
}
