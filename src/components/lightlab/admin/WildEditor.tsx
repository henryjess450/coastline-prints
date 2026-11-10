"use client";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { useRef, useState, useTransition } from "react";
import { lightlab } from "@config/lightlab";
import { addWildPhotoAction, deleteWildPhotoAction, reorderWildPhotosAction, updateWildPhotoAction } from "@/app/lightlab/admin/wild/actions";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { shopImageUrl } from "@/lib/shop/types";
import type { WildPhotoDto } from "@/lib/shop/wild.server";

const input = "h-10 w-full rounded-xl border border-line bg-elev px-3 text-sm outline-none focus:border-accent-line";

/**
 * "In the wild" (LightLab admin): customers' photos of their lamps at home.
 * Upload, credit the Instagram name, say which lamp it is (it then shows on
 * that lamp's page too), hide or delete. Drag to reorder. Changes save as you go.
 */
export function WildEditor({ initial, products }: { initial: WildPhotoDto[]; products: { id: string; name: string }[] }) {
  const [photos, setPhotos] = useState(initial);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(files: File[]) {
    setError(null);
    const batch = files.filter((f) => f.type.startsWith("image/")).slice(0, 20);
    setUploading((n) => n + batch.length);
    for (const f of batch) {
      const body = new FormData();
      body.append("file", f);
      try {
        const res = await fetch("/api/shop/admin/images", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(`${f.name}: ${data.error ?? "upload failed."}`);
          continue;
        }
        const r = await addWildPhotoAction(data.key);
        if (r.error || !r.id) setError(r.error ?? "Couldn't add it.");
        else setPhotos((ps) => [{ id: r.id!, key: data.key, url: shopImageUrl(data.key), handle: "", caption: "", productId: null, active: true }, ...ps]);
      } catch {
        setError(`${f.name}: upload failed. Check your connection.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function patch(id: string, change: Partial<WildPhotoDto>) {
    setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, ...change } : p)));
  }

  function save(p: WildPhotoDto) {
    start(async () => {
      const r = await updateWildPhotoAction({ id: p.id, handle: p.handle, caption: p.caption, productId: p.productId, active: p.active });
      setError(r.error ?? null);
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this photo from the wall? This can't be undone.")) return;
    setPhotos((ps) => ps.filter((p) => p.id !== id));
    start(async () => void (await deleteWildPhotoAction(id)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">In the wild</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Customers&apos; photos of their lamps at home, usually from Instagram tags (ask before you use one). They show on the LightLab page, and on a lamp&apos;s own page when you pick which lamp it is.</p>
        </div>
        <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass("primary", "md")}>
          + Add photos
        </button>
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
      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      {!photos.length && !uploading && <p className="rounded-3xl border border-dashed border-line-strong p-10 text-center text-muted">No photos yet. Add one to start the wall. JPG, PNG or WebP, up to {lightlab.maxImageMb} MB.</p>}
      {Array.from({ length: uploading }, (_, i) => (
        <div key={`up${i}`} className="skeleton h-28 w-full rounded-3xl" aria-label="Uploading" />
      ))}
      <Reorder.Group
        axis="y"
        values={photos}
        onReorder={(next: WildPhotoDto[]) => {
          setPhotos(next);
          start(async () => void (await reorderWildPhotosAction(next.map((p) => p.id))));
        }}
        className="space-y-3"
      >
        {photos.map((p) => (
          <Reorder.Item key={p.id} value={p} className={cn("grid cursor-grab grid-cols-[6rem_minmax(0,1fr)] gap-4 rounded-3xl border border-line bg-surface p-3 active:cursor-grabbing sm:grid-cols-[7rem_minmax(0,1fr)_auto]", !p.active && "opacity-60")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" draggable={false} className="aspect-square w-full rounded-2xl object-cover" />
            <div className="grid min-w-0 gap-2 sm:grid-cols-2" onPointerDown={(e) => e.stopPropagation()}>
              <input value={p.handle} onChange={(e) => patch(p.id, { handle: e.target.value })} onBlur={() => save(p)} placeholder="@their.instagram (optional)" aria-label="Instagram name" className={input} />
              <select value={p.productId ?? ""} onChange={(e) => (patch(p.id, { productId: e.target.value || null }), save({ ...p, productId: e.target.value || null }))} aria-label="Which lamp" className={input}>
                <option value="">Which lamp? (optional)</option>
                {products.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <input value={p.caption} onChange={(e) => patch(p.id, { caption: e.target.value })} onBlur={() => save(p)} maxLength={160} placeholder="Caption (optional), like “Fun-gi on a bookshelf in Oak Bay”" aria-label="Caption" className={cn(input, "sm:col-span-2")} />
            </div>
            <div className="col-span-2 flex items-center justify-end gap-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-center" onPointerDown={(e) => e.stopPropagation()}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={p.active} onChange={(e) => (patch(p.id, { active: e.target.checked }), save({ ...p, active: e.target.checked }))} className="h-4 w-4 accent-[var(--accent)]" />
                Shown
              </label>
              <button type="button" onClick={() => remove(p.id)} className="text-sm text-muted underline-offset-4 hover:text-danger hover:underline">
                Delete
              </button>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
}
