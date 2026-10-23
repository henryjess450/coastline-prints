"use client";
import Link from "next/link";
import { forwardRef } from "react";
import { buttonClass, type Size, type Variant } from "./button-class";

export { buttonClass };

/** A happy little bounce for success moments (code applied, ready to pay). */
export function bounce(el: HTMLElement | null) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate(
    [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-5px) scale(1.04)" }, { transform: "translateY(1px) scale(0.98)" }, { transform: "translateY(0) scale(1)" }],
    { duration: 480, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
  );
}

/** Replays the CSS squash animation on every click. */
export function squash(el: HTMLElement) {
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
