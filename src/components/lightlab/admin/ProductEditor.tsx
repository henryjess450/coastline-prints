"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { useEffect, useRef, useState, useTransition } from "react";
import { lightlab } from "@config/lightlab";
import { shopConfig, type ShopId } from "@config/shops";
import { deleteProductAction, discardImagesAction, saveProductAction, type ProductInput } from "@/app/lightlab/admin/actions";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { shopImageUrl, slugify, type ShopProductDto } from "@/lib/shop/types";
import type { ProductFileDto } from "@/lib/shop/files";
import { dollars, parseDollars } from "./money";
import { ProductFiles } from "./ProductFiles";

type VariantDraft = { key: string; id?: string; name: string; price: string; stock: string; hex: string | null };

const input = "h-11 w-full rounded-xl border border-line bg-elev px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]";
let seq = 0;
const newKey = () => `v${Date.now()}${seq++}`;

/** Add or edit one product, in LightLab or the Coastline shop. */
export function ProductEditor({ product, categories, files = [], shop: newShop = "lightlab" }: { product: ShopProductDto | null; categories: string[]; /** The owner's print files (admin only). */ files?: ProductFileDto[]; /** For a new product. */ shop?: ShopId }) {
  const router = useRouter();
  const shop = shopConfig(product?.shop ?? newShop);
  const [personalize, setPersonalize] = useState(product?.personalize ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!product);
  const [tagline, setTagline] = useState(product?.tagline ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [price, setPrice] = useState(dollars(product?.priceCents));
  const [compareAt, setCompareAt] = useState(dollars(product?.compareAtCents));
  const [tracked, setTracked] = useState(product ? product.stock != null : true);
  const [stock, setStock] = useState(product?.stock != null ? String(product.stock) : "1");
  const [variants, setVariants] = useState<VariantDraft[]>(
    () => product?.variants.map((v) => ({ key: v.id, id: v.id, name: v.name, price: dollars(v.priceCents), stock: v.stock == null ? "" : String(v.stock), hex: v.hex })) ?? [],
  );
  const [images, setImages] = useState<string[]>(product?.imageKeys ?? []);
  const [size, setSize] = useState({ x: String(product?.size.x ?? 150), y: String(product?.size.y ?? 150), z: String(product?.size.z ?? 200) });
  const [grams, setGrams] = useState(String(product?.grams ?? 400));
  const [active, setActive] = useState(product?.active ?? true);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [error, setError] = useState<{ text: string; n: number } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  // Photos uploaded this session that aren't saved on the product yet (removed from storage if abandoned).
  const fresh = useRef(new Set<string>());
  const savedImages = useRef(new Set(product?.imageKeys ?? []));

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
  useEffect(
    () => () => {
      const orphans = [...fresh.current].filter((k) => !savedImages.current.has(k));
      if (orphans.length) void discardImagesAction(orphans);
    },
    [],
  );

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
    setSaved(null);
  };
  const fail = (text: string) => setError((e) => ({ text, n: (e?.n ?? 0) + 1 }));

  function build(): ProductInput | null {
    const priceCents = parseDollars(price);
    if (priceCents == null || Number.isNaN(priceCents)) return fail("Enter a price, like 34.99."), null;
    const compareAtCents = parseDollars(compareAt);
    if (Number.isNaN(compareAtCents)) return fail("The \"was\" price should look like 44.99, or be empty."), null;
    const stockN = tracked ? Number(stock) : null;
    if (stockN != null && (!Number.isInteger(stockN) || stockN < 0)) return fail("Stock is a whole number."), null;
    const vs: ProductInput["variants"] = [];
    for (const v of variants) {
      const vp = parseDollars(v.price);
      if (Number.isNaN(vp)) return fail(`${v.name || "An option"}: price should look like 34.99, or be empty to use the product's price.`), null;
      const vsN = v.stock.trim() === "" ? null : Number(v.stock);
      if (vsN != null && (!Number.isInteger(vsN) || vsN < 0)) return fail(`${v.name || "An option"}: stock is a whole number, or empty.`), null;
      vs.push({ id: v.id, name: v.name, priceCents: vp, stock: vsN, hex: v.hex });
    }
    const dims = [size.x, size.y, size.z, grams].map(Number);
    if (dims.some((n) => !(n > 0))) return fail("Fill in the boxed size and weight (used for shipping prices)."), null;
    return {
      id: product?.id ?? null,
      shop: shop.id,
      personalize: personalize.trim() || null,
      name,
      slug: slugTouched ? slug : slugify(name),
      tagline,
      description,
      category,
      priceCents,
      compareAtCents,
      stock: stockN,
      variants: vs,
      images,
      sizeXMm: dims[0],
      sizeYMm: dims[1],
      sizeZMm: dims[2],
      grams: dims[3],
      active,
      featured,
    };
  }

  function save() {
    setError(null);
    const data = build();
    if (!data) return;
    start(async () => {
      const r = await saveProductAction(data);
      if (r.error) return fail(r.error);
      savedImages.current = new Set(images);
      setDirty(false);
      setSaved(r.message ?? "Saved.");
      if (!product && r.id) router.replace(`${shop.admin}/products/${r.id}`);
      else router.refresh();
    });
  }

  function remove() {
    if (!product || !confirm(`Delete ${product.name}? Past orders keep their details, but it's gone from the shop for good, along with any print files saved with it. To take it off the shop for now, switch off "On the shop" instead.`)) return;
    start(async () => {
      const r = await deleteProductAction(product.id);
      if (r.error) return fail(r.error);
      setDirty(false);
      router.push(shop.admin);
      router.refresh();
    });
  }

  const priceCents = parseDollars(price);
  const variantOverrides = variants.some((v) => v.stock.trim() !== "");

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <Panel title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <input value={name} onChange={(e) => touch(setName)(e.target.value)} className={input} maxLength={100} placeholder="Moon Lamp" autoFocus={!product} />
            </Field>
            <Field label="One line under the name" className="sm:col-span-2">
              <input value={tagline} onChange={(e) => touch(setTagline)(e.target.value)} className={input} maxLength={160} placeholder="A glowing moon for your desk" />
            </Field>
            <Field label="Category">
              <input value={category} onChange={(e) => touch(setCategory)(e.target.value)} className={input} list="ll-categories" maxLength={40} placeholder={shop.id === "lightlab" ? "Desk lamps" : "Keychains"} />
              <datalist id="ll-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Personalisation (optional)" hint={'Asks the shopper to type something, like "Name on the keychain". Leave empty if there\'s nothing to personalise.'} className="sm:col-span-2">
              <input value={personalize} onChange={(e) => touch(setPersonalize)(e.target.value)} className={input} maxLength={60} placeholder="Name on the keychain" />
            </Field>
            <Field label="Web address" hint={`${shop.base}/${slugTouched ? slug || "…" : slugify(name || "product")}`}>
              <input
                value={slugTouched ? slug : slugify(name)}
                onChange={(e) => {
                  setSlugTouched(true);
                  touch(setSlug)(slugify(e.target.value));
                }}
                className={cn(input, "font-mono")}
                maxLength={60}
              />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <textarea value={description} onChange={(e) => touch(setDescription)(e.target.value)} rows={6} maxLength={5000} className={cn(input, "h-auto py-2.5 leading-relaxed")} placeholder="Size, bulb, how it's powered, what it's printed in…" />
            </Field>
          </div>
        </Panel>

        <Panel title="Photos" note={`The first photo is the cover. Drag to reorder. JPG, PNG or WebP, up to ${lightlab.maxImageMb} MB.`}>
          <Photos
            images={images}
            onChange={touch(setImages)}
            onUploaded={(k) => fresh.current.add(k)}
            onError={fail}
          />
        </Panel>

        <Panel title="Print files" note="Your STL and 3MF files for this product, so you always know where they are. Only you can see these; they're never on the shop.">
          <ProductFiles productId={product?.id ?? null} initial={files} onError={fail} />
        </Panel>

        <Panel title="Options" note="Shade colours, sizes and so on. Each can have its own price and stock; leave them empty to use the product's.">
          <Variants value={variants} onChange={touch(setVariants)} basePrice={priceCents != null && !Number.isNaN(priceCents) ? priceCents : null} />
        </Panel>

        <Panel title="Shipping" note="The size of the boxed lamp and its weight, so shipping is priced right. Pickup is always free.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(["x", "y", "z"] as const).map((k, i) => (
              <Field key={k} label={["Length (mm)", "Width (mm)", "Height (mm)"][i]}>
                <input value={size[k]} onChange={(e) => touch(setSize)({ ...size, [k]: e.target.value })} inputMode="decimal" className={cn(input, "font-mono")} />
              </Field>
            ))}
            <Field label="Weight (g)">
              <input value={grams} onChange={(e) => touch(setGrams)(e.target.value)} inputMode="decimal" className={cn(input, "font-mono")} />
            </Field>
          </div>
        </Panel>
      </div>

      <div className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
        <Panel title="Price">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price ($)">
              <input value={price} onChange={(e) => touch(setPrice)(e.target.value)} inputMode="decimal" className={cn(input, "font-mono")} placeholder="34.99" />
            </Field>
            <Field label="Was ($)" hint="Optional markdown">
              <input value={compareAt} onChange={(e) => touch(setCompareAt)(e.target.value)} inputMode="decimal" className={cn(input, "font-mono")} placeholder="—" />
            </Field>
          </div>
        </Panel>

        <Panel title="Stock">
          <div className="space-y-3">
            <Switch on={tracked} onChange={touch(setTracked)} label="Count stock" detail={tracked ? "Sells out when it hits 0. Goes down by itself with each sale." : "Made to order: never sells out."} />
            {tracked && (
              <Field label={variantOverrides ? "Stock (for options without their own)" : "In stock"}>
                <input value={stock} onChange={(e) => touch(setStock)(e.target.value)} inputMode="numeric" className={cn(input, "font-mono")} />
              </Field>
            )}
          </div>
        </Panel>

        <Panel title="Visibility">
          <div className="space-y-3">
            <Switch on={active} onChange={touch(setActive)} label="On the shop" detail={active ? "People can see and buy it." : "Hidden. Only you can see it here."} />
            <Switch on={featured} onChange={touch(setFeatured)} label="Featured" detail="Shown first on the shop." />
          </div>
        </Panel>

        <div className="space-y-3">
          <AnimatePresence>
            {error && (
              <motion.p key={error.n} role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: [0, -8, 8, -4, 4, 0] }} exit={{ opacity: 0 }} className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                {error.text}
              </motion.p>
            )}
          </AnimatePresence>
          <Button size="lg" className="w-full" onClick={save} disabled={pending || !name.trim()}>
            {pending ? "Saving…" : product ? "Save changes" : "Add product"}
          </Button>
          <AnimatePresence>
            {saved && !dirty && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-sm text-success" role="status">
                {saved}{" "}
                {product && active && (
                  <Link href={`${shop.base}/${product.slug}`} target="_blank" className="underline underline-offset-4">
                    View it ↗
                  </Link>
                )}
              </motion.p>
            )}
          </AnimatePresence>
          {product && (
            <button type="button" onClick={remove} disabled={pending} className="w-full py-2 text-sm text-muted underline-offset-4 hover:text-danger hover:underline">
              Delete product
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 flex items-baseline justify-between gap-2 text-xs font-medium text-muted">
        {label}
        {hint && <span className="truncate font-normal text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Switch({ on, onChange, label, detail }: { on: boolean; onChange: (v: boolean) => void; label: string; detail?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-start gap-3 text-left">
      <span className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors", on ? "border-accent-line bg-accent" : "border-line-strong bg-elev")}>
        <motion.span className={cn("absolute top-[3px] h-4 w-4 rounded-full", on ? "bg-accent-ink" : "bg-faint")} animate={{ left: on ? 23 : 3 }} transition={{ type: "spring", stiffness: 600, damping: 32 }} />
      </span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {detail && <span className="block text-xs text-muted">{detail}</span>}
      </span>
    </button>
  );
}

function Photos({ images, onChange, onUploaded, onError }: { images: string[]; onChange: (v: string[]) => void; onUploaded: (key: string) => void; onError: (msg: string) => void }) {
  const [uploading, setUploading] = useState(0);
  const [over, setOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  }, [images]);

  async function upload(files: File[]) {
    const room = lightlab.maxImagesPerProduct - latest.current.length;
    if (room <= 0) return onError(`Up to ${lightlab.maxImagesPerProduct} photos per product.`);
    const batch = files.filter((f) => f.type.startsWith("image/")).slice(0, room);
    setUploading((n) => n + batch.length);
    for (const f of batch) {
      const body = new FormData();
      body.append("file", f);
      try {
        const res = await fetch("/api/shop/admin/images", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) onError(`${f.name}: ${data.error ?? "upload failed."}`);
        else {
          onUploaded(data.key);
          latest.current = [...latest.current, data.key];
          onChange(latest.current);
        }
      } catch {
        onError(`${f.name}: upload failed. Check your connection.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  return (
    <div>
      <Reorder.Group axis="x" values={images} onReorder={onChange} className="flex flex-wrap gap-3">
        {images.map((k, i) => (
          <Reorder.Item key={k} value={k} className="group relative h-28 w-28 cursor-grab overflow-hidden rounded-2xl border border-line bg-elev active:cursor-grabbing">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shopImageUrl(k)} alt="" draggable={false} className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink">Cover</span>}
            <button type="button" onClick={() => onChange(images.filter((x) => x !== k))} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-bg/85 text-sm opacity-100 backdrop-blur transition-opacity hover:text-danger sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Remove photo ${i + 1}`}>
              ✕
            </button>
          </Reorder.Item>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <div key={`up${i}`} className="skeleton h-28 w-28 rounded-2xl" aria-label="Uploading" />
        ))}
        {images.length + uploading < lightlab.maxImagesPerProduct && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void upload([...e.dataTransfer.files]);
            }}
            className={cn("grid h-28 w-28 place-items-center rounded-2xl border-2 border-dashed text-center text-xs text-muted transition-[border-color,transform] hover:border-accent-line active:scale-95", over ? "scale-105 border-accent-line" : "border-line-strong")}
          >
            <span>
              <span className="block text-2xl leading-none">+</span>
              Add photos
            </span>
          </button>
        )}
      </Reorder.Group>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          void upload([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Variants({ value, onChange, basePrice }: { value: VariantDraft[]; onChange: (v: VariantDraft[]) => void; basePrice: number | null }) {
  const set = (key: string, patch: Partial<VariantDraft>) => onChange(value.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  const small = "h-10 w-full rounded-lg border border-line bg-elev px-2.5 text-sm outline-none focus:border-accent-line";
  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 hidden grid-cols-[2.25rem_minmax(0,1fr)_6rem_5rem_2rem] gap-2 px-1 text-xs text-faint sm:grid">
          <span>Swatch</span>
          <span>Name</span>
          <span>Price ($)</span>
          <span>Stock</span>
          <span />
        </div>
      )}
      <Reorder.Group axis="y" values={value} onReorder={onChange} className="space-y-2">
        <AnimatePresence initial={false}>
          {value.map((v) => (
            <Reorder.Item key={v.key} value={v} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-[2.25rem_minmax(0,1fr)_2rem] items-center gap-2 sm:grid-cols-[2.25rem_minmax(0,1fr)_6rem_5rem_2rem]">
              <SwatchPicker value={v.hex} onChange={(hex) => set(v.key, { hex })} />
              <input value={v.name} onChange={(e) => set(v.key, { name: e.target.value })} placeholder="White shade" maxLength={60} className={small} aria-label="Option name" />
              <button type="button" onClick={() => onChange(value.filter((x) => x.key !== v.key))} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-strong hover:text-danger sm:col-start-5 sm:row-start-1" aria-label={`Remove ${v.name || "option"}`}>
                ✕
              </button>
              <input value={v.price} onChange={(e) => set(v.key, { price: e.target.value })} placeholder={basePrice != null ? dollars(basePrice) : "same"} inputMode="decimal" className={cn(small, "col-span-2 col-start-2 font-mono sm:col-span-1 sm:col-start-3 sm:row-start-1")} aria-label="Option price (empty = product price)" />
              <input value={v.stock} onChange={(e) => set(v.key, { stock: e.target.value })} placeholder="shared" inputMode="numeric" className={cn(small, "col-span-2 col-start-2 font-mono sm:col-span-1 sm:col-start-4 sm:row-start-1")} aria-label="Option stock (empty = the product's stock)" />
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <button type="button" onClick={() => onChange([...value, { key: newKey(), name: "", price: "", stock: "", hex: null }])} className={buttonClass("secondary", "sm", "mt-3")}>
        + Add option
      </button>
      {value.length > 0 && basePrice != null && (
        <p className="mt-3 text-xs text-faint">
          Empty price uses {money(basePrice)}. Empty stock shares the product&apos;s stock count.
        </p>
      )}
    </div>
  );
}

/** A colour dot that opens the system colour picker; tap again to clear. */
function SwatchPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <span className="relative h-9 w-9">
      <input type="color" value={value ?? "#ffffff"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Swatch colour" />
      <span className={cn("pointer-events-none block h-9 w-9 rounded-full border", value ? "border-line-strong" : "border-dashed border-line-strong")} style={value ? { background: value } : undefined} />
      {value && (
        <button type="button" onClick={() => onChange(null)} className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-bg text-[9px] text-muted ring-1 ring-line hover:text-danger" aria-label="No swatch">
          ✕
        </button>
      )}
    </span>
  );
}
