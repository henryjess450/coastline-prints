import { cn } from "@/lib/cn";

export type Variant = "primary" | "secondary" | "ghost" | "danger";
export type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-7 text-base",
};

/** Button classes. Kept out of Button.tsx ("use client") so server pages can call it too. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn("btn", `btn-${variant}`, sizes[size], className);
}
