"use client";

let loading: Promise<void> | null = null;

/** Loads Square's Web Payments SDK script once. */
export function loadSquareSdk(src: string): Promise<void> {
  if (typeof window !== "undefined" && window.Square) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the payment form. Check your connection and refresh."));
    };
    document.head.appendChild(s);
  });
  return loading;
}
