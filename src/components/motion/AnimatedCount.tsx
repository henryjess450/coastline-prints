"use client";
import { AnimatedNumber } from "./AnimatedNumber";

const whole = (n: number) => String(Math.round(n));

/** A whole number that counts up on load and ticks when it changes. Usable from server components. */
export function AnimatedCount({ value, className }: { value: number; className?: string }) {
  return <AnimatedNumber value={value} from={0} format={whole} live={false} className={className} />;
}
