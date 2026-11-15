"use client";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import type { ShopOptionSet } from "@/lib/shop/types";

/**
 * A product's extra option sets (cord colour, plug...) as rows of chips, one
 * choice picked in each. `value` holds the picked choice ids; a set with
 * none of them shows its first choice as picked.
 */
export function ChoiceSets({ sets, value, onChange, size = "md", className }: { sets: ShopOptionSet[]; value: string[]; onChange: (choices: string[]) => void; /** "lg" for the kiosk and the customer display. */ size?: "md" | "lg"; className?: string }) {
  const lg = size === "lg";
  return (
    <>
      {sets.map((set) => {
        if (!set.choices.length) return null;
        const picked = set.choices.find((c) => value.includes(c.id)) ?? set.choices[0];
        return (
          <fieldset key={set.id} className={className}>
            <legend className={cn("mb-2 font-medium", lg ? "text-lg" : "text-sm")}>
              {set.name}
              <span className="font-normal text-muted">: {picked.name}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {set.choices.map((c) => {
                const on = c.id === picked.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange([...value.filter((id) => !set.choices.some((x) => x.id === id)), c.id])}
                    className={cn("inline-flex items-center gap-2 rounded-full border-2 transition-[border-color,background-color,transform] active:scale-95", lg ? "min-h-14 px-5 text-lg" : "px-3.5 py-2 text-sm", on ? "border-accent-line bg-accent-soft font-semibold" : "border-line")}
                  >
                    {c.hex && <span className={cn("shrink-0 rounded-full border border-line-strong", lg ? "h-6 w-6" : "h-4 w-4")} style={{ background: c.hex }} aria-hidden />}
                    {c.name}
                    {c.extraCents > 0 && <span className="font-mono text-xs font-normal text-muted">+{money(c.extraCents)}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </>
  );
}
