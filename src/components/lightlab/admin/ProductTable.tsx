"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { useState, useTransition } from "react";
import { quickUpdateAction, reorderProductsAction } from "@/app/lightlab/admin/actions";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import type { ShopProductDto } from "@/lib/shop/types";
import { shopConfig, type ShopId } from "@config/shops";
import { ProductPlaceholder } from "../ProductGrid";
import { dollars, parseDollars } from "./money";

type Stats = Record<string, { units: number; cents: number }>;

/** Every product, with the things that change most (price, stock, shown) editable right here. Drag to reorder the shop. */
export function ProductTable({ products, stats, shop = "lightlab" }: { products: ShopProductDto[]; stats: Stats; shop?: ShopId }) {
  const { admin } = shopConfig(shop);
  const router = useRouter();
  const [order, setOrder] = useState(products);
  const [flash, setFlash] = useState<{ text: string; bad?: boolean; n: number } | null>(null);
  // Fresh data from the server (after a save) replaces the local order.
  const [seen, setSeen] = useState(products);
  if (seen !== products) {
    setSeen(products);
    setOrder(products);
  }

  const say = (text: string, bad = false) => setFlash((f) => ({ text, bad, n: (f?.n ?? 0) + 1 }));

  async function saveOrder() {
    const ids = order.map((p) => p.id);
    if (ids.join() === products.map((p) => p.id).join()) return;
    const r = await reorderProductsAction(ids);
    say(r.error ?? "Shop order saved.", !!r.error);
    router.refresh();
  }

  if (!products.length) {
    return (
      <div className="rounded-3xl border border-line bg-surface px-6 py-16 text-center">
        <p className="font-display text-xl font-semibold">No products yet.</p>
        <p className="mt-2 text-muted">Add your first {shop === "lightlab" ? "lamp" : "product"} and it shows up on the shop straight away.</p>
        <Link href={`${admin}/products/new`} className={buttonClass("primary", "md", "mt-6")}>
          Add a product
        </Link>
      </div>
    );
  }

  const live = products.filter((p) => p.active).length;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {products.length} {products.length === 1 ? "product" : "products"}, {live} on the shop. Drag <span aria-hidden>⠿</span> to change the order they show in.
        </p>
        <AnimatePresence mode="wait">
          {flash && (
            <motion.p key={flash.n} role="status" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("text-sm", flash.bad ? "text-danger" : "text-success")}>
              {flash.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2">
        {order.map((p) => (
          <Row key={p.id} product={p} stats={stats[p.id]} onDrop={saveOrder} onSaved={(t, bad) => say(t, bad)} />
        ))}
      </Reorder.Group>
    </div>
  );
}

function Row({ product: p, stats, onDrop, onSaved }: { product: ShopProductDto; stats?: { units: number; cents: number }; onDrop: () => void; onSaved: (text: string, bad?: boolean) => void }) {
  const router = useRouter();
  const drag = useDragControls();
  const [pending, start] = useTransition();
  const [price, setPrice] = useState(dollars(p.priceCents));
  const [stock, setStock] = useState(p.stock == null ? "" : String(p.stock));
  // Saved values from the server replace what's typed.
  const [seen, setSeen] = useState({ price: p.priceCents, stock: p.stock });
  if (seen.price !== p.priceCents || seen.stock !== p.stock) {
    setSeen({ price: p.priceCents, stock: p.stock });
    setPrice(dollars(p.priceCents));
    setStock(p.stock == null ? "" : String(p.stock));
  }

  function save(patch: Parameters<typeof quickUpdateAction>[1], label: string) {
    start(async () => {
      const r = await quickUpdateAction(p.id, patch);
      onSaved(r.error ?? `${p.name}: ${label}${r.message ?? ""}`, !!r.error);
      router.refresh();
    });
  }

  function commitPrice() {
    const c = parseDollars(price);
    if (c == null || Number.isNaN(c)) {
      setPrice(dollars(p.priceCents));
      if (price.trim()) onSaved("Prices look like 24.99.", true);
      return;
    }
    if (c !== p.priceCents) save({ priceCents: c }, `price is now ${money(c)}.`);
  }

  function commitStock() {
    const t = stock.trim();
    const n = t === "" ? null : Number(t);
    if (n != null && (!Number.isInteger(n) || n < 0)) {
      setStock(p.stock == null ? "" : String(p.stock));
      return onSaved("Stock is a whole number, or empty for made to order.", true);
    }
    if (n !== p.stock) save({ stock: n }, n == null ? "made to order." : `${n} in stock.`);
  }

  const optionStock = p.variants.some((v) => v.stock != null);
  const input = "h-9 rounded-lg border border-line bg-elev px-2 font-mono text-sm outline-none focus:border-accent-line";

  return (
    <Reorder.Item value={p} dragListener={false} dragControls={drag} onDragEnd={onDrop} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3 sm:flex-nowrap sm:gap-4", !p.active && "opacity-60", pending && "animate-pulse")}>
      <button type="button" onPointerDown={(e) => drag.start(e)} className="cursor-grab touch-none px-1 text-lg text-faint active:cursor-grabbing" aria-label={`Drag ${p.name} to reorder`}>
        ⠿
      </button>
      <Link href={`${shopConfig(p.shop).admin}/products/${p.id}`} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line bg-elev">
        {p.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <ProductPlaceholder shop={p.shop} />
        )}
      </Link>
      <div className="min-w-0 flex-1 basis-40">
        <Link href={`${shopConfig(p.shop).admin}/products/${p.id}`} className="block truncate font-semibold hover:underline">
          {p.name}
        </Link>
        <p className="truncate text-xs text-muted">
          {[p.category, p.variants.length ? `${p.variants.length} options` : null, stats ? `${stats.units} sold · ${money(stats.cents)}` : "none sold yet"].filter(Boolean).join(" · ")}
        </p>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        $
        <input value={price} onChange={(e) => setPrice(e.target.value)} onBlur={commitPrice} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} inputMode="decimal" aria-label={`${p.name} price`} className={cn(input, "w-20")} />
      </label>
      {optionStock ? (
        <span className="w-28 text-xs text-muted" title="Each option has its own stock. Edit the product to change it.">
          Stock per option
        </span>
      ) : (
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Stock
          <input value={stock} onChange={(e) => setStock(e.target.value)} onBlur={commitStock} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} inputMode="numeric" placeholder="∞" aria-label={`${p.name} stock (empty = made to order)`} className={cn(input, "w-16", p.stock === 0 && "border-danger text-danger")} />
        </label>
      )}
      <Toggle on={p.featured} label="Featured" onChange={(v) => save({ featured: v }, v ? "featured." : "no longer featured.")} />
      <Toggle on={p.active} label="On shop" onChange={(v) => save({ active: v }, v ? "now showing on the shop." : "hidden from the shop.")} />
      <Link href={`${shopConfig(p.shop).admin}/products/${p.id}`} className={buttonClass("secondary", "sm")}>
        Edit
      </Link>
    </Reorder.Item>
  );
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center gap-2 text-xs text-muted">
      <span className={cn("relative h-5 w-9 rounded-full border transition-colors", on ? "border-accent-line bg-accent" : "border-line-strong bg-elev")}>
        <motion.span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full", on ? "bg-accent-ink" : "bg-faint")} animate={{ left: on ? 18 : 2 }} transition={{ type: "spring", stiffness: 600, damping: 32 }} />
      </span>
      {label}
    </button>
  );
}
