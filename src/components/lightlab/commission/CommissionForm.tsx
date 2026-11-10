"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "@/components/account/use-account";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Shade = { name: string; hex: string };

const field = "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base outline-none transition-[border-color,box-shadow] focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]";

/** The "Make me a lamp" request: idea, photos, shade colour, a date if there is one, and how to reach them. */
export function CommissionForm({ shades, maxPhotos, maxPhotoMb }: { shades: Shade[]; maxPhotos: number; maxPhotoMb: number }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", phone: "", idea: "", neededBy: "" });
  const [shade, setShade] = useState<Shade | null>(null);
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState<{ text: string; n: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useAccount((a) => {
    if (a.signedIn) setF((x) => ({ ...x, name: x.name || a.name || "", email: x.email || a.email || "" }));
  });
  // Previews are freed when they go.
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (text: string) => setError((e) => ({ text, n: (e?.n ?? 0) + 1 }));

  function addPhotos(files: File[]) {
    const ok = files.filter((file) => /^image\/(jpeg|png|webp)$/.test(file.type));
    if (ok.length < files.length) fail("Photos need to be JPG, PNG or WebP.");
    const big = ok.find((file) => file.size > maxPhotoMb * 1024 * 1024);
    if (big) return fail(`${big.name} is over ${maxPhotoMb} MB.`);
    setPhotos((ps) => [...ps, ...ok.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, maxPhotos));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.idea.trim().length < 15) return fail("Tell us a bit more about the lamp you're picturing.");
    setBusy(true);
    setError(null);
    const body = new FormData();
    Object.entries(f).forEach(([k, v]) => body.append(k, v));
    if (shade) {
      body.append("shade", shade.name);
      body.append("shadeHex", shade.hex);
    }
    photos.forEach((p) => body.append("photos", p.file));
    const res = await fetch("/api/lightlab/commission", { method: "POST", body }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setBusy(false);
      return fail(data.error ?? "Couldn't send that. Check your connection and try again.");
    }
    router.push(`/lightlab/commission/${data.token}?sent=1`);
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-8">
      <section>
        <label htmlFor="cm-idea" className="block font-display text-xl font-semibold">
          Your idea
        </label>
        <p className="mt-1 text-sm text-muted">Who or what is holding the bulb? How big? Where will it go? Anything goes.</p>
        <textarea id="cm-idea" required rows={6} maxLength={2000} value={f.idea} onChange={(e) => setF({ ...f, idea: e.target.value })} placeholder="My cat Biscuit sitting up, holding the bulb in his paws, about 30 cm tall, for my desk." className={cn(field, "mt-3 h-auto py-3 leading-relaxed")} />
      </section>

      <section>
        <p className="font-display text-xl font-semibold">Photos (optional)</p>
        <p className="mt-1 text-sm text-muted">The figure, your pet, a sketch: anything that helps. Up to {maxPhotos}. Only we see them.</p>
        <ul className="mt-3 flex flex-wrap gap-3">
          <AnimatePresence initial={false}>
            {photos.map((p, i) => (
              <motion.li key={p.url} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="relative h-24 w-24 overflow-hidden rounded-2xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => (URL.revokeObjectURL(p.url), setPhotos((ps) => ps.filter((x) => x !== p)))} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-bg/85 text-sm backdrop-blur hover:text-danger" aria-label={`Remove photo ${i + 1}`}>
                  ✕
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
          {photos.length < maxPhotos && (
            <li>
              <button type="button" onClick={() => fileInput.current?.click()} className="grid h-24 w-24 place-items-center rounded-2xl border-2 border-dashed border-line-strong text-center text-xs text-muted transition-[border-color,transform] hover:border-accent-line active:scale-95">
                <span>
                  <span className="block text-2xl leading-none">+</span>
                  Add photo
                </span>
              </button>
            </li>
          )}
        </ul>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => (addPhotos([...(e.target.files ?? [])]), (e.target.value = ""))} />
      </section>

      <section>
        <p className="font-display text-xl font-semibold">Shade colour</p>
        <p className="mt-1 text-sm text-muted">{shade ? shade.name : "Pick one, or leave it with us."}</p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Shade colour">
          {shades.map((s) => {
            const on = shade?.name === s.name;
            return (
              <button key={s.name} type="button" role="radio" aria-checked={on} title={s.name} aria-label={s.name} onClick={() => setShade(on ? null : s)} className={cn("h-10 w-10 rounded-full border transition-transform active:scale-90", on ? "scale-110 border-fg shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--fg)]" : "border-line-strong hover:scale-105")} style={{ background: s.hex }} />
            );
          })}
          <button type="button" role="radio" aria-checked={!shade} onClick={() => setShade(null)} className={cn("h-10 rounded-full border px-4 text-sm", !shade ? "border-fg font-medium" : "border-line text-muted")}>
            Help me choose
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Your name</span>
          <input required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Email (the quote goes here)</span>
          <input required type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Phone (optional)</span>
          <input type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Need it by (optional)</span>
          <input type="date" value={f.neededBy} onChange={(e) => setF({ ...f, neededBy: e.target.value })} className={field} />
        </label>
      </section>

      <AnimatePresence>
        {error && (
          <motion.p key={error.n} role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: [0, -8, 8, -4, 4, 0] }} exit={{ opacity: 0 }} className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {error.text}
          </motion.p>
        )}
      </AnimatePresence>
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy}>
        {busy ? "Sending…" : "Send my idea"}
      </Button>
      <p className="text-xs text-faint">We&apos;ll only use your details for this request.</p>
    </form>
  );
}
