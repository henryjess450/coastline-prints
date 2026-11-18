"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { saveTagAction, saveTagSizeAction } from "@/app/admin/price-tag-actions";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { describeScreen, ScreenLink, screenSupported } from "./screen-link";

type Product = { id: string; shop: "lightlab" | "coastline"; name: string; image: string | null; colors: string[]; priceColor: string | null };
type Size = { widthIn: number; heightIn: number };
type Screen = { link: ScreenLink; wired: boolean; showing: string | null };

/** Price tags: pick a drawing and colours for each product, see the tag, and print the ones you need from a PDF. */
export function PriceTags({ shop, size, products }: { shop: "lightlab" | "coastline"; size: Size; products: Product[] }) {
  const list = products.filter((p) => p.shop === shop);
  const [copies, setCopies] = useState<Record<string, number>>({});
  const picked = Object.entries(copies).filter(([id, n]) => n > 0 && list.some((p) => p.id === id));
  const total = picked.reduce((s, [, n]) => s + n, 0);
  const pdfHref = `/api/admin/price-tags/pdf?items=${picked.map(([id, n]) => `${id}:${n}`).join(",")}`;
  const [screen, setScreen] = useState<Screen | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Price tags</h1>
          <p className="text-sm text-muted">Upload each product&apos;s drawing, pick its colours, then print the ones you need. The PDF is real size: print it at 100% (&ldquo;Actual size&rdquo;) and cut along the borders.</p>
        </div>
        <div className="flex rounded-full border border-line p-1 text-sm font-medium">
          {(["lightlab", "coastline"] as const).map((s) => (
            <Link key={s} href={`/admin/price-tags?shop=${s}`} className={cn("rounded-full px-4 py-1.5", s === shop ? "bg-accent text-accent-ink" : "text-muted hover:text-fg")}>
              {s === "lightlab" ? "LightLab" : "Coastline"}
            </Link>
          ))}
        </div>
      </div>

      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur">
        <SizeForm size={size} />
        <ScreenButton screen={screen} setScreen={setScreen} />
        <span className="ml-auto text-sm text-muted">{total ? `${total} tag${total === 1 ? "" : "s"} picked` : "Pick how many of each below"}</span>
        <button type="button" disabled={!total} onClick={() => setCopies({})} className={buttonClass("secondary", "sm")}>
          Clear
        </button>
        <button type="button" onClick={() => setCopies(Object.fromEntries(list.map((p) => [p.id, Math.max(1, copies[p.id] ?? 0)])))} className={buttonClass("secondary", "sm")}>
          One of each
        </button>
        <a href={total ? pdfHref : undefined} target="_blank" rel="noreferrer" aria-disabled={!total} className={cn(buttonClass("primary", "sm"), !total && "pointer-events-none opacity-40")}>
          Open PDF to print
        </a>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">No {shop === "lightlab" ? "LightLab" : "Coastline"} products yet.</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {list.map((p) => (
            <TagEditor key={p.id} product={p} size={size} screen={screen} setScreen={setScreen} copies={copies[p.id] ?? 0} setCopies={(n) => setCopies((c) => ({ ...c, [p.id]: n }))} />
          ))}
        </div>
      )}
    </div>
  );
}

function SizeForm({ size }: { size: Size }) {
  const [w, setW] = useState(String(size.widthIn));
  const [h, setH] = useState(String(size.heightIn));
  const [pending, start] = useTransition();
  const changed = Number(w) !== size.widthIn || Number(h) !== size.heightIn;
  const box = "h-9 w-16 rounded-lg border border-line bg-elev px-2 text-sm";
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted">Size</span>
      <input className={box} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} aria-label="Width in inches" />
      <span>×</span>
      <input className={box} inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} aria-label="Height in inches" />
      <span className="text-muted">in</span>
      {changed && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveTagSizeAction(Number(w), Number(h));
              toast(r.error ?? r.message ?? "Saved.", r.error ? "error" : "success");
            })
          }
          className={buttonClass("secondary", "sm")}
        >
          Save size
        </button>
      )}
    </div>
  );
}

const noSubscribe = () => () => {};

/** Connects to the screen price tag over USB (the ESP32 with the little OLED, see firmware/pricetag). */
function ScreenButton({ screen, setScreen }: { screen: Screen | null; setScreen: (s: Screen | null) => void }) {
  const [busy, setBusy] = useState(false);
  const supported = useSyncExternalStore(noSubscribe, screenSupported, () => false);
  if (!supported) return null;

  async function connect() {
    setBusy(true);
    try {
      const r = await ScreenLink.connect(true);
      if (!r) return;
      r.link.onClose = () => {
        setScreen(null);
        toast("Screen unplugged.");
      };
      const d = describeScreen(r.status);
      setScreen({ link: r.link, ...d });
      if (!d.wired) toast("Board found, but no screen on it. Check the wires: SDA to D21, SCL to D22 (D4 and D5 on a XIAO).", "error");
    } catch (err) {
      if ((err as Error).name !== "NotFoundError") toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return screen ? (
    <span className="flex items-center gap-2 text-sm">
      <span className={cn("h-2 w-2 rounded-full", screen.wired ? "bg-emerald-500" : "bg-amber-500")} />
      <span className="text-muted">{screen.wired ? (screen.showing ? `Screen: ${screen.showing}` : "Screen connected") : "Board connected, no screen"}</span>
      <button
        type="button"
        onClick={async () => {
          await screen.link.close(true);
          setScreen(null);
        }}
        className="text-xs text-muted underline hover:text-fg"
      >
        Disconnect
      </button>
    </span>
  ) : (
    <button type="button" disabled={busy} onClick={connect} className={buttonClass("secondary", "sm")}>
      {busy ? "Connecting…" : "Connect screen"}
    </button>
  );
}

function TagEditor({ product, size, screen, setScreen, copies, setCopies }: { product: Product; size: Size; screen: Screen | null; setScreen: (s: Screen | null) => void; copies: number; setCopies: (n: number) => void }) {
  const [image, setImage] = useState(product.image);
  const [colors, setColors] = useState(product.colors.length ? product.colors : ["#111111"]);
  const [priceColor, setPriceColor] = useState<string | null>(product.priceColor);
  const [uploading, setUploading] = useState(false);
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = image !== product.image || colors.join() !== (product.colors.length ? product.colors : ["#111111"]).join() || priceColor !== product.priceColor;

  // The preview follows every change, a moment after it stops.
  const src = useMemo(() => {
    const q = new URLSearchParams({ product: product.id, colors: colors.join(","), price: priceColor ?? "" });
    if (image) q.set("image", image);
    q.set("s", `${size.widthIn}x${size.heightIn}`);
    return `/api/admin/price-tags/preview?${q}`;
  }, [product.id, colors, priceColor, image, size]);
  const [shown, setShown] = useState(src);
  useEffect(() => {
    const t = setTimeout(() => setShown(src), 350);
    return () => clearTimeout(t);
  }, [src]);

  const [sending, setSending] = useState(false);
  async function showOnScreen() {
    if (!screen) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/price-tags/screen?product=${product.id}&format=raw`);
      if (!res.ok) throw new Error("Couldn't draw the screen tag.");
      await screen.link.sendTag(product.name, new Uint8Array(await res.arrayBuffer()));
      setScreen({ ...screen, showing: product.name });
      toast(screen.wired ? `${product.name} is on the screen.` : "Saved on the board, but no screen is wired to it.", screen.wired ? "success" : "error");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/shop/admin/images", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed.");
      setImage(body.key);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{product.name}</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Print</span>
          <button type="button" onClick={() => setCopies(Math.max(0, copies - 1))} className="grid h-8 w-8 place-items-center rounded-full border border-line" aria-label="Fewer">
            −
          </button>
          <span className="w-6 text-center font-semibold tabular-nums">{copies}</span>
          <button type="button" onClick={() => setCopies(Math.min(50, copies + 1))} className="grid h-8 w-8 place-items-center rounded-full border border-line" aria-label="More">
            +
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl bg-white p-2" style={{ aspectRatio: `${size.widthIn} / ${size.heightIn}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shown} alt={`${product.name} price tag`} className="h-full w-full object-contain" />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Drawing</p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={buttonClass("secondary", "sm")}>
            {uploading ? "Uploading…" : image ? "Replace drawing" : "Upload drawing"}
          </button>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Name colour{colors.length > 1 ? "s (gradient)" : ""}</p>
          <div className="flex items-center gap-1.5">
            {colors.map((c, i) => (
              <span key={i} className="relative">
                <input type="color" value={c} onChange={(e) => setColors(colors.map((x, j) => (j === i ? e.target.value : x)))} className="h-9 w-9 cursor-pointer rounded-lg border border-line bg-transparent p-0.5" aria-label={`Name colour ${i + 1}`} />
                {colors.length > 1 && (
                  <button type="button" onClick={() => setColors(colors.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-fg text-[10px] text-bg" aria-label="Remove colour">
                    ×
                  </button>
                )}
              </span>
            ))}
            {colors.length < 4 && (
              <button type="button" onClick={() => setColors([...colors, colors[colors.length - 1]])} className="h-9 rounded-lg border border-dashed border-line px-2 text-xs text-muted hover:text-fg" title="Add a colour for a gradient">
                + colour
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Price colour</p>
          <div className="flex items-center gap-2">
            <input type="color" value={priceColor ?? colors[colors.length - 1]} onChange={(e) => setPriceColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded-lg border border-line bg-transparent p-0.5" aria-label="Price colour" />
            {priceColor && (
              <button type="button" onClick={() => setPriceColor(null)} className="text-xs text-muted hover:text-fg">
                Match name
              </button>
            )}
          </div>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          disabled={!dirty || saving}
          onClick={() =>
            startSave(async () => {
              const r = await saveTagAction(product.id, { image, colors, priceColor });
              toast(r.error ?? r.message ?? "Saved.", r.error ? "error" : "success");
            })
          }
          className={cn(buttonClass("primary", "sm"), "ml-auto")}
        >
          {saving ? "Saving…" : dirty ? "Save tag" : "Saved"}
        </motion.button>
      </div>

      {screen && (
        <div className="mt-4 flex items-center gap-4 border-t border-line pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/admin/price-tags/screen?product=${product.id}&v=${product.image ?? ""}`} alt={`${product.name} on the screen`} className="h-24 w-24 rounded-md bg-black [image-rendering:pixelated]" />
          <div className="flex-1 text-sm text-muted">{dirty ? "Save the tag first; the screen shows the saved version." : screen.showing === product.name ? "On the screen now." : "How it looks on the little screen."}</div>
          <button type="button" disabled={sending || dirty} onClick={showOnScreen} className={buttonClass(screen.showing === product.name ? "secondary" : "primary", "sm")}>
            {sending ? "Sending…" : screen.showing === product.name ? "Send again" : "Show on screen"}
          </button>
        </div>
      )}
    </Card>
  );
}
