"use client";
import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Tweens between values (e.g. prices) instead of jumping. */
export function AnimatedNumber({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(value);
  const reduce = useReducedMotion();
  // Initial text only; later updates are written directly by the tween so
  // React re-renders don't fight the animation.
  const [initial] = useState(() => format(value));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = format(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
        from.current = v;
      },
    });
    return () => controls.stop();
  }, [value, format, reduce]);

  return (
    <span ref={ref} className={className} aria-live="polite">
      {initial}
    </span>
  );
}
