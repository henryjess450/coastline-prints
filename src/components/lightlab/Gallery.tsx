"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { ProductPlaceholder } from "./ProductGrid";

/**
 * A product's photos: swipe or tap thumbnails to move through them (dots that
 * stretch under the photo on phones), a soft glow behind in the chosen shade's
 * colour, an optional name tag that writes itself as the shopper types, and a
 * full-screen view on tap (pinch or double-tap to zoom, swipe down to close).
 */
export function Gallery({ images, name, shop, glow, tag, note = null, onPick }: { images: string[]; name: string; shop: string; /** The chosen option's colour. */ glow: string | null; /** Personalised text, shown on a little tag. */ tag: string | null; /** A small line on the photo, like "Pictured in Pink". */ note?: string | null; /** A thumbnail was tapped (its URL), so the page can pick the option it shows. */ onPick?: (src: string) => void }) {
  const [photo, setPhoto] = useState(0);
  const [dir, setDir] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  // A new set of photos (another option picked): start again from its first one, crossfading.
  const [shown, setShown] = useState(images.join("|"));
  if (shown !== images.join("|")) {
    setShown(images.join("|"));
    setPhoto(0);
    setDir(0);
  }
  const go = (i: number) => {
    const next = (i + images.length) % images.length;
    setDir(next > photo ? 1 : -1);
    setPhoto(next);
  };

  return (
    <div className="min-w-0">
      <div className="relative isolate">
        {/* The chosen colour, glowing softly behind the photo like the lamp is on. */}
        <AnimatePresence>
          {glow && <motion.div key="glow" aria-hidden className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] blur-3xl" initial={{ opacity: 0 }} animate={{ opacity: 0.45, backgroundColor: glow }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} />}
        </AnimatePresence>
        <div className="relative aspect-square touch-pan-y overflow-hidden rounded-3xl border border-line bg-surface">
          {images.length ? (
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.img
                key={images[photo]}
                src={images[photo]}
                alt={images.length > 1 ? `${name}, photo ${photo + 1} of ${images.length}` : name}
                custom={dir}
                variants={{ enter: (d: number) => ({ x: d * 60, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: d * -60, opacity: 0 }) }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                drag={images.length > 1 ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.35}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -50 || info.velocity.x < -400) go(photo + 1);
                  else if (info.offset.x > 50 || info.velocity.x > 400) go(photo - 1);
                }}
                // A tap (not a swipe) opens the full-screen view.
                onTap={() => setZoomed(true)}
                draggable={false}
                className="absolute inset-0 h-full w-full cursor-zoom-in select-none object-cover"
              />
            </AnimatePresence>
          ) : (
            <ProductPlaceholder shop={shop} />
          )}
          <NameTag text={tag} />
          <AnimatePresence>
            {note && (
              <motion.p key={note} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute right-3 top-3 rounded-full bg-bg/85 px-3 py-1 text-xs text-fg backdrop-blur">
                {note}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        {images.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5 sm:hidden" aria-hidden>
            {images.map((src, i) => (
              <motion.span key={src} animate={{ width: i === photo ? 20 : 6, opacity: i === photo ? 1 : 0.35 }} transition={{ type: "spring", stiffness: 500, damping: 34 }} className="h-1.5 rounded-full bg-fg" />
            ))}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 hidden gap-2 overflow-x-auto pb-1 sm:flex">
          {images.map((src, i) => (
            <button key={src} type="button" onClick={() => (go(i), onPick?.(src))} aria-label={`Photo ${i + 1}`} aria-pressed={i === photo} className={cn("h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 transition-[border-color,transform,opacity] active:scale-95", i === photo ? "border-accent-line" : "border-transparent opacity-70 hover:opacity-100")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <AnimatePresence>{zoomed && images.length > 0 && <Zoom images={images} name={name} start={photo} onClose={(i) => (setZoomed(false), setPhoto(i))} />}</AnimatePresence>
    </div>
  );
}

/** A little hang tag in the corner of the photo with the shopper's text on it, writing itself in as they type. */
function NameTag({ text }: { text: string | null }) {
  return (
    <AnimatePresence>
      {text && (
        <motion.div
          key="tag"
          aria-hidden
          initial={{ opacity: 0, y: -16, rotate: -14 }}
          animate={{ opacity: 1, y: 0, rotate: -6 }}
          exit={{ opacity: 0, y: -12, rotate: -14 }}
          transition={{ type: "spring", stiffness: 380, damping: 18 }}
          style={{ transformOrigin: "50% 0%" }}
          className="pointer-events-none absolute bottom-5 left-5 flex max-w-[70%] items-center gap-2 rounded-xl border border-black/10 bg-[#fffaf0] py-2 pl-2.5 pr-4 text-[#1c1917] shadow-lg"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-black/25" />
          <span className="truncate font-display text-lg font-semibold">
            {[...text].map((ch, i) => (
              <motion.span key={`${i}-${ch}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="inline-block whitespace-pre">
                {ch}
              </motion.span>
            ))}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Full screen: double-tap or click to zoom to where you tapped, pinch works too, swipe down (or Esc) to close. */
function Zoom({ images, name, start, onClose }: { images: string[]; name: string; start: number; onClose: (photo: number) => void }) {
  const [i, setI] = useState(start);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const still = useReducedMotion();
  const close = () => onClose(i);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(i);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const step = e.key === "ArrowRight" ? 1 : -1;
        setZoom(null);
        setI((n) => (n + step + images.length) % images.length);
      }
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [i, images.length, onClose]);

  return createPortal(
    <motion.div role="dialog" aria-modal="true" aria-label={`${name} photos`} className="fixed inset-0 z-[60] grid place-items-center bg-black/90" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.img
        key={i}
        src={images[i]}
        alt={name}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onTap={(e, info) => {
          const r = (e.target as HTMLElement).getBoundingClientRect();
          const x = info.point.x - window.scrollX;
          const y = info.point.y - window.scrollY;
          setZoom((z) => (z ? null : { x: ((x - r.left) / r.width) * 100, y: ((y - r.top) / r.height) * 100 }));
        }}
        initial={{ scale: still ? 1 : 0.92, opacity: 0 }}
        animate={{ scale: zoom ? 2.2 : 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        style={{ transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : "50% 50%", touchAction: "pinch-zoom" }}
        drag={zoom ? false : "y"}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.6}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.y) > 110 || Math.abs(info.velocity.y) > 600) close();
        }}
        className={cn("max-h-[88vh] max-w-[94vw] select-none rounded-2xl object-contain", zoom ? "cursor-zoom-out" : "cursor-zoom-in")}
      />
      <button type="button" onClick={close} aria-label="Close" className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20">
        ✕
      </button>
      {images.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={(e) => (e.stopPropagation(), setZoom(null), setI((n) => (n - 1 + images.length) % images.length))} className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-xl text-white backdrop-blur hover:bg-white/20">
            ‹
          </button>
          <button type="button" aria-label="Next photo" onClick={(e) => (e.stopPropagation(), setZoom(null), setI((n) => (n + 1) % images.length))} className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-xl text-white backdrop-blur hover:bg-white/20">
            ›
          </button>
          <p className="absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] font-mono text-xs text-white/60">
            {i + 1} / {images.length} · swipe down to close
          </p>
        </>
      )}
    </motion.div>,
    document.body,
  );
}
