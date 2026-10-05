"use client";
import { useEffect, useRef, useState } from "react";

/** True while the element is on screen; used to pause 3D scenes that scroll away. */
export function useVisible<T extends Element>(rootMargin = "100px", threshold = 0) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin, threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, threshold]);
  return [ref, visible] as const;
}
