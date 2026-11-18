"use client";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * The tablet's front camera, looking for a QR code: a thank-you card held up
 * to the screen. Uses the browser's own reader where there is one, and jsQR
 * (loaded only when needed) everywhere else, iPads included.
 */
export function CardScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false });
      } catch {
        return setError("The camera isn't available. Ask us at the stand, or type the card's number in your bag.");
      }
      if (stopped || !video.current) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);

      const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const native = Native ? new Native({ formats: ["qr_code"] }) : null;
      const jsQR = native ? null : (await import("jsqr")).default;

      let last = 0;
      const tick = async (t: number) => {
        if (stopped || done.current) return;
        const v = video.current;
        // A few looks a second is plenty, and kind to the tablet's battery.
        if (v && v.readyState >= 2 && t - last > 200) {
          last = t;
          let text: string | null = null;
          if (native) text = (await native.detect(v).catch(() => []))[0]?.rawValue ?? null;
          else if (jsQR && ctx) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
          }
          if (text && !done.current) {
            done.current = true;
            return onScan(text);
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <motion.div className="fixed inset-0 z-[400] grid place-items-center bg-black/80 px-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="w-full max-w-xl rounded-[28px] border border-line bg-elev p-6 text-center">
        <p className="font-display text-3xl font-bold">Hold up your card</p>
        <p className="mt-1 text-lg text-muted">Show the QR code on your thank-you card to the camera.</p>
        <div className="relative mx-auto mt-5 aspect-[4/3] w-full overflow-hidden rounded-3xl bg-black">
          {/* Mirrored, so moving the card left moves it left on screen. */}
          <video ref={video} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          {!error && (
            <motion.span className="absolute inset-x-[18%] h-1 rounded-full bg-[#ffd98a] opacity-80" initial={{ top: "12%" }} animate={{ top: "86%" }} transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }} aria-hidden />
          )}
          <span className="pointer-events-none absolute inset-[14%] rounded-3xl border-4 border-white/70" aria-hidden />
        </div>
        {error && <p className="mt-4 text-lg text-danger">{error}</p>}
        <button type="button" onClick={onClose} className="mt-5 h-14 w-full rounded-full border border-line text-lg font-semibold">
          Never mind
        </button>
      </div>
    </motion.div>
  );
}
