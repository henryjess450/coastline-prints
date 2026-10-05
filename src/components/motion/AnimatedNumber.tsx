"use client";
import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Tweens between values (e.g. prices) instead of jumping. `pulse` gives the
 * number a small bump when it changes; `live` announces changes to screen
 * readers (turn it off for secondary numbers). `from` sets where the first
 * tween starts (e.g. 0 to count up on load).
 */
export function AnimatedNumber({
  value,
  format,
  className,
  pulse,
  live = true,
  from: start,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
  pulse?: boolean;
  live?: boolean;
  from?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(start ?? value);
  const reduce = useReducedMotion();
  // Initial text only; later updates are written directly by the tween so
  // React re-renders don't fight the animation.
  const [initial] = useState(() => format(start ?? value));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = format(value);
      from.current = value;
      return;
    }
    if (pulse && from.current !== value) el.animate([{ transform: "scale(1)" }, { transform: "scale(1.07)" }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
    const controls = animate(from.current, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
        from.current = v;
      },
    });
    return () => controls.stop();
  }, [value, format, reduce, pulse]);

  return (
    <span ref={ref} className={pulse ? `inline-block ${className ?? ""}` : className} aria-live={live ? "polite" : undefined}>
      {initial}
    </span>
  );
}
