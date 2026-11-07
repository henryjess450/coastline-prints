"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A photo that fades in once it's loaded, over a soft shimmering placeholder,
 * instead of popping in line by line. Already-cached photos show straight away.
 */
export function FadeImg({ className, wrapClassName, ...img }: React.ImgHTMLAttributes<HTMLImageElement> & { wrapClassName?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <span aria-hidden className={cn("skeleton absolute inset-0 rounded-none", wrapClassName)} />}
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img
        {...img}
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) setLoaded(true);
        }}
        onLoad={(e) => (setLoaded(true), img.onLoad?.(e))}
        className={cn("transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", className)}
      />
    </>
  );
}
