"use client";
import { reducedMotion } from "./index";

/**
 * A little copy of the photo flies from `from` into the header's cart in an
 * arc, then the cart gives a bounce. Calls `landed` when it arrives (straight
 * away for reduced motion or when there's no cart on screen).
 */
export function flyToCart(from: Element | null, image: string | null, landed: () => void) {
  const cart = document.querySelector<HTMLElement>("[data-cart-button]");
  if (!from || !cart || reducedMotion()) return landed();
  const a = from.getBoundingClientRect();
  const b = cart.getBoundingClientRect();
  const size = Math.min(a.width, a.height, 160);
  const sx = a.left + a.width / 2 - size / 2;
  const sy = a.top + a.height / 2 - size / 2;
  const dx = b.left + b.width / 2 - (sx + size / 2);
  const dy = b.top + b.height / 2 - (sy + size / 2);

  // The item goes in the cart even if the animation is held up (a background tab pauses it).
  let done = false;
  const land = () => {
    if (done) return;
    done = true;
    landed();
  };
  const safety = setTimeout(() => (el.remove(), land()), 1000);

  const el = document.createElement(image ? "img" : "div");
  if (image) (el as HTMLImageElement).src = image;
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = `position:fixed;left:${sx}px;top:${sy}px;width:${size}px;height:${size}px;border-radius:24px;object-fit:cover;z-index:70;pointer-events:none;box-shadow:0 12px 32px rgb(0 0 0 / .35);background:var(--accent)`;
  document.body.appendChild(el);
  // Up a little first, then down into the cart, shrinking as it goes.
  const anim = el.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1, borderRadius: "24px" },
      { transform: `translate(${dx * 0.45}px, ${Math.min(dy, 0) * 0.5 - 60}px) scale(0.55)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.6, borderRadius: "9999px" },
    ],
    { duration: 720, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
  );
  anim.onfinish = () => {
    clearTimeout(safety);
    el.remove();
    cart.animate(
      [{ transform: "scale(1) rotate(0)" }, { transform: "scale(1.22) rotate(-8deg)" }, { transform: "scale(0.94) rotate(4deg)" }, { transform: "scale(1) rotate(0)" }],
      { duration: 520, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    );
    land();
  };
}
