"use client";
import { useEffect, useRef } from "react";

/**
 * On desktop in dark mode, a faint warm light follows the mouse, like carrying
 * a lamp through the shop. It eases after the pointer rather than snapping,
 * never catches clicks, and isn't there on touch screens, in light mode, or
 * for anyone who prefers reduced motion.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    let x = innerWidth / 2,
      y = innerHeight / 3,
      tx = x,
      ty = y,
      raf = 0;
    const tick = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.transform = `translate3d(${x - 300}px, ${y - 300}px, 0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      el.style.opacity = "1";
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const leave = () => (el.style.opacity = "0");
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <div ref={ref} aria-hidden className="ll-cursor-glow pointer-events-none fixed left-0 top-0 z-30 h-[600px] w-[600px] rounded-full opacity-0 transition-opacity duration-500" />;
}
