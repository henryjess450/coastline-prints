"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { shipping as shipCfg } from "@config/shipping";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { packageName, type ShippingMethod, type ShippingOption, type ShippingQuote } from "@/lib/shipping/pack";
import { Field, inputClass } from "./fields";

export type DeliveryMethod = "pickup" | "ship";
export type AddressDraft = { name: string; line1: string; line2: string; city: string; province: string; postal: string };
export type AddressErrors = Partial<Record<keyof AddressDraft, string>>;

export const emptyAddress: AddressDraft = { name: "", line1: "", line2: "", city: "", province: "", postal: "" };

/** The Canada Post logo on a white chip, so its blue stays readable in dark mode. */
function CanadaPostLogo() {
  return (
    <span className="relative shrink-0 rounded-lg bg-white px-1.5 py-1 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/canada-post.svg" alt="Canada Post" width={300} height={68} className="block h-5 w-auto" />
    </span>
  );
}

/** Two big pills: free local pickup, or Canada Post anywhere in Canada. */
export function MethodToggle({ value, onChange, shipping }: { value: DeliveryMethod; onChange: (m: DeliveryMethod) => void; shipping: ShippingQuote | null }) {
  const cheapest = shipping?.ok ? shipping.options[0].totalCents : null;
  const options = [
    { id: "pickup" as const, title: "Local pickup", detail: "Free", disabled: false },
    {
      id: "ship" as const,
      title: "Ship in Canada",
      detail: shipping ? (cheapest != null ? `${shipping.ok && shipping.options.length > 1 ? "from " : ""}${money(cheapest)}` : "Not available") : "…",
      disabled: !shipping?.ok,
    },
  ];
  return (
    <div>
      <div role="radiogroup" aria-label="Pickup or shipping" className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={o.disabled}
              onClick={() => onChange(o.id)}
              className={cn(
                "relative flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left transition-[border-color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
                active ? "border-accent-line" : "border-line hover:border-accent-line",
              )}
            >
              {active && <motion.span layoutId="delivery-active" className="absolute -inset-px rounded-2xl border-2 border-accent-line bg-accent-soft" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
              <span className="relative flex min-w-0 flex-col">
                <span className="font-semibold">{o.title}</span>
                <span className="font-mono text-sm text-muted">{o.detail}</span>
              </span>
              {o.id === "ship" && <CanadaPostLogo />}
            </button>
          );
        })}
      </div>
      {shipping && !shipping.ok && <p className="mt-3 text-sm text-muted">{shipping.reason}</p>}
    </div>
  );
}

const optionText: Record<ShippingMethod, { title: string; detail: string }> = {
  mailer: { title: "Bubble mailer", detail: "Lettermail. No tracking." },
  parcel: { title: "Tracked bubble mailer", detail: "Sent as a small parcel, with tracking." },
  box: { title: "Tracked box", detail: "Flat rate box with tracking and up to $100 coverage." },
};

/** Mailer, tracked mailer or tracked box, when there's a choice. */
export function ShipOptions({ options, value, onChange, parcelHint }: { options: ShippingOption[]; value: ShippingMethod; onChange: (m: ShippingMethod) => void; parcelHint?: "postal" | "loading" | null }) {
  if (options.length < 2 && !parcelHint) return null;
  return (
    <div role="radiogroup" aria-label="Shipping option" className="grid gap-2 sm:grid-cols-2">
      {parcelHint && (
        <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted sm:col-span-2">
          <span className="font-semibold text-fg">{optionText.parcel.title}</span> may be cheaper.{" "}
          {parcelHint === "loading" ? "Checking the price with Canada Post…" : "Enter your postal code below to see its price."}
        </p>
      )}
      {options.map((o) => {
        const active = o.method === value;
        return (
          <button
            key={o.method}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.method)}
            className={cn(
              "relative flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-[border-color,transform] duration-150 active:scale-[0.97]",
              active ? "border-accent-line" : "border-line hover:border-accent-line",
            )}
          >
            {active && <motion.span layoutId="ship-option-active" className="absolute -inset-px rounded-2xl border-2 border-accent-line" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
            <span className="relative">
              <span className="block font-semibold">{optionText[o.method].title}</span>
              <span className="block text-muted">{optionText[o.method].detail}</span>
            </span>
            <span className="relative font-mono">{money(o.totalCents)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** What goes in each package, and what it costs. */
export function BoxSummary({ option }: { option: ShippingOption }) {
  return (
    <div className="rounded-2xl bg-accent-soft px-4 py-3 text-sm">
      <p className="font-medium">
        {option.method === "mailer"
          ? "Padded bubble mailer by Canada Post Lettermail, anywhere in Canada"
          : `Canada Post flat rate ${option.boxes.length === 1 ? "box" : "boxes"} with tracking, anywhere in Canada`}
      </p>
      <ul className="mt-1.5 space-y-0.5 text-muted">
        {option.boxes.map((b, i) => (
          <motion.li key={`${option.method}${i}`} className="flex justify-between gap-3" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
            <span>
              {packageName(b)} · {b.pieces} {b.pieces === 1 ? "piece" : "pieces"}
            </span>
            <span className="font-mono">{money(b.priceCents)}</span>
          </motion.li>
        ))}
        {option.taxCents > 0 && (
          <li className="flex justify-between gap-3">
            <span>{option.taxLabel} on postage</span>
            <span className="font-mono">{money(option.taxCents)}</span>
          </li>
        )}
        <li className="flex justify-between gap-3">
          <span>Packing and padding</span>
          <span className="font-mono">{money(option.packingCents)}</span>
        </li>
      </ul>
    </div>
  );
}

type Suggestion = { label: string; line1: string; city: string; province: string; postal: string };

/**
 * Street address with suggestions as they type (Canadian addresses only).
 * Picking one fills in the city, province and postal code too.
 */
function StreetInput({ value, onChange, onPick, error, flash }: { value: string; onChange: (v: string) => void; onPick: (s: Suggestion) => void; error?: string; flash?: boolean }) {
  const [list, setList] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const picked = useRef<string | null>(null);

  useEffect(() => {
    const q = value.trim();
    // Only look things up while they're typing (not right after picking or autofill).
    if (q.length < 4 || !/\d/.test(q) || picked.current === value || !open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const res = await fetch(`/api/address/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal }).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (!ctrl.signal.aborted) {
        setList(data?.suggestions ?? []);
        setActive(-1);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, open]);

  const shown = open && list.length > 0 && value.trim().length >= 4;
  const pick = (sug: Suggestion) => {
    picked.current = sug.line1;
    onPick(sug);
    setOpen(false);
    setList([]);
  };

  return (
    <div className="relative">
      <input
        id="ship-line1"
        role="combobox"
        aria-expanded={shown}
        aria-controls="ship-line1-list"
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `ship-sug-${active}` : undefined}
        autoComplete="shipping address-line1"
        placeholder="Start typing, e.g. 123 Main St"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!shown) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % list.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? list.length - 1 : i - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(list[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className={inputClass(error, flash && !!value)}
        aria-invalid={!!error}
        aria-describedby="ship-line1-err"
      />
      <AnimatePresence>
        {shown && (
          <motion.ul
            id="ship-line1-list"
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-line-strong bg-elev py-1 shadow-lg"
          >
            {list.map((sug, i) => (
              <li
                key={sug.label}
                id={`ship-sug-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(sug);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("cursor-pointer px-3.5 py-2 text-sm", i === active ? "bg-accent-soft text-fg" : "text-muted")}
              >
                <span className="font-medium text-fg">{sug.line1}</span>, {sug.city} {sug.province} {sug.postal}
              </li>
            ))}
            <li aria-hidden className="px-3.5 pb-1 pt-1.5 text-[11px] text-faint">
              Suggestions from OpenStreetMap
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AddressForm({ value, onChange, errors, flash }: { value: AddressDraft; onChange: (k: keyof AddressDraft, v: string) => void; errors: AddressErrors; flash?: boolean }) {
  const text = (k: keyof AddressDraft, label: string, autoComplete: string, opts: { className?: string; placeholder?: string; valid?: boolean } = {}) => (
    <Field id={`ship-${k}`} label={label} error={errors[k]} valid={opts.valid} className={opts.className}>
      <input
        id={`ship-${k}`}
        autoComplete={autoComplete}
        placeholder={opts.placeholder}
        value={value[k]}
        onChange={(e) => onChange(k, e.target.value)}
        className={inputClass(errors[k], flash && !!value[k])}
        aria-invalid={!!errors[k]}
        aria-describedby={`ship-${k}-err`}
      />
    </Field>
  );
  const postalOk = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(value.postal.trim());

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {text("name", "Recipient name", "shipping name", { className: "sm:col-span-2", valid: value.name.trim().length >= 2 })}
      {/* Above the fields below it, so the suggestions cover them instead of mixing in. */}
      <Field id="ship-line1" label="Street address" error={errors.line1} valid={value.line1.trim().length >= 3} className="relative z-30 sm:col-span-2">
        <StreetInput
          value={value.line1}
          onChange={(v) => onChange("line1", v)}
          onPick={(sug) => {
            onChange("line1", sug.line1);
            onChange("city", sug.city);
            onChange("province", sug.province);
            if (sug.postal) onChange("postal", sug.postal);
          }}
          error={errors.line1}
          flash={flash}
        />
      </Field>
      {text("line2", "Apartment, unit or buzzer (optional)", "shipping address-line2", { className: "sm:col-span-2" })}
      {text("city", "City", "shipping address-level2", { valid: value.city.trim().length >= 2 })}
      <Field id="ship-province" label="Province or territory" error={errors.province}>
        <select
          id="ship-province"
          autoComplete="shipping address-level1"
          value={value.province}
          onChange={(e) => onChange("province", e.target.value)}
          className={cn(inputClass(errors.province, flash && !!value.province), "appearance-none")}
          aria-invalid={!!errors.province}
        >
          <option value="" disabled>
            Choose…
          </option>
          {shipCfg.provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      {text("postal", "Postal code", "shipping postal-code", { placeholder: "A1A 1A1", valid: postalOk })}
    </div>
  );
}
