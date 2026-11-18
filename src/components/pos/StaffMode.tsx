"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { fieldInput as input } from "@/components/admin/PrintFiles";
import { cn } from "@/lib/cn";
import { endStaff, startStaff } from "@/lib/pos/staff";

const pinOk = (s: string) => /^\d{4}$/.test(s);

/** Turning staff mode on (pick a PIN, twice) or off (type it). */
export function StaffMode({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pinField = (value: string, set: (v: string) => void, label: string, autoFocus = false) => (
    <input autoFocus={autoFocus} type="password" inputMode="numeric" autoComplete="off" maxLength={4} className={cn(input, "h-16 text-center font-mono text-3xl tracking-[0.5em]")} value={value} onChange={(e) => (set(e.target.value.replace(/\D/g, "").slice(0, 4)), setError(null))} aria-label={label} placeholder="••••" />
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pinOk(pin)) return setError("Type 4 digits.");
    setBusy(true);
    if (on) {
      const err = await endStaff(pin);
      setBusy(false);
      if (err) return (setError(err), setPin(""));
      return onChange(false);
    }
    if (pin !== again) return (setBusy(false), setError("The two PINs don't match."));
    await startStaff(pin);
    setBusy(false);
    onChange(true);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {on ? (
        <>
          <p className="text-muted">Type the staff mode PIN to unlock the register&apos;s settings and the admin.</p>
          {pinField(pin, setPin, "PIN", true)}
        </>
      ) : (
        <>
          <p className="text-muted">A helper can ring up sales, but the admin menu and the register&apos;s settings are hidden, and other admin pages bring them back here. Pick a 4-digit PIN to get out of it again. It only locks this iPad.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {pinField(pin, setPin, "PIN", true)}
            {pinField(again, setAgain, "PIN again")}
          </div>
        </>
      )}
      {error && <p className="text-danger">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy || !pinOk(pin) || (!on && !pinOk(again))}>
        {on ? "Unlock" : "Lock to staff mode"}
      </Button>
    </form>
  );
}
