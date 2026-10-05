"use client";
import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn("btn", `btn-${variant}`, sizes[size], className);
}

/** Replays the CSS squash animation on every click. */
function squash(el: HTMLElement) {
  el.classList.remove("is-squash");
  void el.offsetWidth; // restart the animation
  el.classList.add("is-squash");
  el.addEventListener("animationend", () => el.classList.remove("is-squash"), { once: true });
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      onClick={(e) => {
        squash(e.currentTarget);
        onClick?.(e);
      }}
      {...rest}
    />
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode } & Omit<
  React.ComponentProps<typeof Link>,
  "href" | "className"
>) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} onClick={(e) => squash(e.currentTarget)} {...rest}>
      {children}
    </Link>
  );
}
