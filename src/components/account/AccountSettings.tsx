"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Reveal } from "@/components/home/Reveal";
import { bounce, Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AddressForm, emptyAddress, type AddressDraft, type AddressErrors } from "@/components/checkout/Delivery";
import { addressSchema } from "@/lib/checkout/schema";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark";
type Profile = { email: string; name: string; phone: string; theme: Theme | null; address: AddressDraft | null };


const input =
  "h-12 w-full rounded-xl border border-line bg-surface px-4 text-base text-fg outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]";

async function send(method: "POST" | "PATCH", url: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  return { ok: !!res?.ok, error: (data.error as string | undefined) ?? (res ? "Something went wrong. Please try again." : "You seem to be offline. Please try again.") };
}

/** Name, phone, email (confirmed with a code) and light or dark mode. */
export function AccountSettings({ profile, current }: { profile: Profile; current: Theme }) {
  return (
    <div className="space-y-6">
      <Reveal>
        <Details profile={profile} />
      </Reveal>
      <Reveal>
        <ShippingAddress initial={profile.address} name={profile.name} />
      </Reveal>
      <Reveal>
        <Email email={profile.email} />
      </Reveal>
      <Reveal>
        <Appearance initial={profile.theme ?? current} />
      </Reveal>
    </div>
  );
}

function Details({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [saved, setSaved] = useState({ name: profile.name, phone: profile.phone });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; n: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const dirty = name.trim() !== saved.name.trim() || phone.trim() !== saved.phone.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await send("PATCH", "/api/account/me", { name, phone });
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? "Saved. Checkout will use these from now on." : r.error, n: (msg?.n ?? 0) + 1 });
    if (!r.ok) return;
    setSaved({ name, phone });
    bounce(button.current);
  }

  return (
    <Card flat className="p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold">Your details</h2>
      <form onSubmit={save} className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="set-name" className="mb-1.5 block text-xs font-medium text-muted">
            Full name
          </label>
          <input id="set-name" autoComplete="name" value={name} onChange={(e) => (setName(e.target.value), setMsg(null))} className={input} maxLength={120} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="set-phone" className="mb-1.5 block text-xs font-medium text-muted">
            Phone
          </label>
          <input id="set-phone" type="tel" autoComplete="tel" placeholder="604 555 0123" value={phone} onChange={(e) => (setPhone(e.target.value), setMsg(null))} className={input} maxLength={40} />
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <Button ref={button} type="submit" disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save details"}
          </Button>
          <Feedback msg={msg} />
        </div>
      </form>
    </Card>
  );
}

/** Where their orders ship. Fills in checkout when they choose shipping. */
function ShippingAddress({ initial, name }: { initial: AddressDraft | null; name: string }) {
  const start = initial ?? { ...emptyAddress, name };
  const [value, setValue] = useState<AddressDraft>(start);
  const [saved, setSaved] = useState<AddressDraft | null>(initial);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; n: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const say = (ok: boolean, text: string) => setMsg((m) => ({ ok, text, n: (m?.n ?? 0) + 1 }));
  const dirty = JSON.stringify(value) !== JSON.stringify(saved ?? start);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = addressSchema.safeParse(value);
    if (!r.success) {
      const next: AddressErrors = {};
      for (const issue of r.error.issues) next[issue.path[0] as keyof AddressDraft] ??= issue.message;
      setErrors(next);
      return;
    }
    setBusy(true);
    const res = await send("PATCH", "/api/account/me", { address: r.data });
    setBusy(false);
    if (!res.ok) return say(false, res.error);
    const clean = { ...r.data, line2: r.data.line2 ?? "" };
    setValue(clean);
    setSaved(clean);
    say(true, "Saved. Checkout will fill this in when you ship.");
    bounce(button.current);
  }

  async function remove() {
    setBusy(true);
    const res = await send("PATCH", "/api/account/me", { address: null });
    setBusy(false);
    if (!res.ok) return say(false, res.error);
    setSaved(null);
    setValue({ ...emptyAddress, name });
    say(true, "Address removed.");
  }

  return (
    <Card flat className="p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold">Shipping address</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">We fill this in when you choose shipping at checkout. Canada only.</p>
      <form onSubmit={save} className="mt-5 space-y-5">
        <AddressForm
          value={value}
          onChange={(k, v) => {
            setValue((a) => ({ ...a, [k]: v }));
            setErrors((e) => ({ ...e, [k]: undefined }));
            setMsg(null);
          }}
          errors={errors}
        />
        <div className="flex flex-wrap items-center gap-4">
          <Button ref={button} type="submit" disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save address"}
          </Button>
          {saved && (
            <Button type="button" variant="secondary" disabled={busy} onClick={remove}>
              Remove
            </Button>
          )}
          <Feedback msg={msg} />
        </div>
      </form>
    </Card>
  );
}

function Email({ email }: { email: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"show" | "new" | "code">("show");
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; n: number } | null>(null);
  const say = (ok: boolean, text: string) => setMsg((m) => ({ ok, text, n: (m?.n ?? 0) + 1 }));

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    const r = await send("POST", "/api/account/email", { email: next });
    setBusy(false);
    if (!r.ok) return say(false, r.error);
    setMsg(null);
    setStep("code");
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await send("POST", "/api/account/email/confirm", { email: next, code });
    setBusy(false);
    if (!r.ok) return say(false, r.error);
    setStep("show");
    setCode("");
    say(true, "Done. Your account, orders and points are on your new email.");
    router.refresh();
  }

  return (
    <Card flat className="p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold">Email</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">You sign in with this, and receipts go here.</p>
      <AnimatePresence mode="wait" initial={false}>
        {step === "show" && (
          <motion.div key="show" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3">
            <p className="min-w-0 break-all font-medium">{email}</p>
            <Button variant="secondary" size="sm" onClick={() => (setStep("new"), setNext(""), setMsg(null))}>
              Change
            </Button>
          </motion.div>
        )}
        {step === "new" && (
          <motion.form key="new" onSubmit={sendCode} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="mt-5">
            <label htmlFor="set-email" className="mb-1.5 block text-xs font-medium text-muted">
              New email
            </label>
            <input id="set-email" type="email" autoComplete="email" autoFocus required value={next} onChange={(e) => (setNext(e.target.value), setMsg(null))} className={input} />
            <p className="mt-2 text-xs text-faint">We&apos;ll email a code to the new address to make sure it&apos;s yours.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="submit" disabled={busy || !next.trim()}>
                {busy ? "Sending…" : "Send code"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => (setStep("show"), setMsg(null))}>
                Cancel
              </Button>
            </div>
          </motion.form>
        )}
        {step === "code" && (
          <motion.form key="code" onSubmit={confirm} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="mt-5">
            <p className="text-sm text-muted">
              We sent a 6-digit code to <strong className="text-fg">{next}</strong>.
            </p>
            <label htmlFor="set-code" className="sr-only">
              Code
            </label>
            <input
              id="set-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => (setCode(e.target.value.replace(/\D/g, "").slice(0, 6)), setMsg(null))}
              className={cn(input, "mt-3 max-w-56 text-center font-mono text-2xl tracking-[0.4em]")}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy ? "Checking…" : "Confirm new email"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => (setStep("new"), setCode(""), setMsg(null))}>
                Back
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      <div className="mt-3">
        <Feedback msg={msg} />
      </div>
    </Card>
  );
}

/** Switches the page right away (the cookie the server reads is set by the save). */
function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
}

/** Light or dark: switches the page straight away and saves it to the account. */
function Appearance({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; n: number } | null>(null);

  async function pick(t: Theme) {
    if (t === theme) return;
    setTheme(t);
    applyTheme(t);
    const r = await send("PATCH", "/api/account/me", { theme: t });
    setMsg((m) => ({ ok: r.ok, text: r.ok ? `Saved. ${t === "light" ? "Light" : "Dark"} mode on every device you sign in on.` : r.error, n: (m?.n ?? 0) + 1 }));
  }

  return (
    <Card flat className="p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold">Appearance</h2>
      <div className="mt-5 grid grid-cols-2 gap-4" role="radiogroup" aria-label="Theme">
        {(["light", "dark"] as const).map((t) => (
          <ThemeTile key={t} theme={t} selected={theme === t} onPick={() => void pick(t)} />
        ))}
      </div>
      <div className="mt-3">
        <Feedback msg={msg} />
      </div>
    </Card>
  );
}

function ThemeTile({ theme, selected, onPick }: { theme: Theme; selected: boolean; onPick: () => void }) {
  const light = theme === "light";
  // A tiny page in that theme: header bar, a card and a button.
  const c = light ? { bg: "#f5f8fb", card: "#ffffff", line: "#d8e2ec", text: "#0a1520", accent: "#1d4e80" } : { bg: "#0a1520", card: "#12202e", line: "#22364a", text: "#e8f0f7", accent: "#86bbea" };
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.96 }}
      className={cn("relative rounded-2xl border-2 p-3 text-left transition-colors", selected ? "border-accent-line" : "border-line hover:border-line-strong")}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl" style={{ background: c.bg }}>
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${c.line}` }}>
          <span className="h-2 w-10 rounded-full" style={{ background: c.text, opacity: 0.8 }} />
          <span className="h-3 w-8 rounded-full" style={{ background: c.accent }} />
        </div>
        <div className="m-3 rounded-lg p-2.5" style={{ background: c.card, border: `1px solid ${c.line}` }}>
          <span className="block h-2 w-3/4 rounded-full" style={{ background: c.text, opacity: 0.7 }} />
          <span className="mt-1.5 block h-2 w-1/2 rounded-full" style={{ background: c.text, opacity: 0.35 }} />
          <span className="mt-2.5 block h-3.5 w-16 rounded-full" style={{ background: c.accent }} />
        </div>
        {/* Sun or moon, which spins in when chosen */}
        <motion.svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          className="absolute bottom-2 right-2"
          fill="none"
          stroke={light ? "#e9a23b" : "#e9c46a"}
          strokeWidth="2.2"
          strokeLinecap="round"
          animate={selected ? { rotate: light ? [0, 180] : [0, -20, 15, 0], scale: [1, 1.25, 1] } : { rotate: 0, scale: 1 }}
          transition={{ duration: 0.6 }}
          aria-hidden
        >
          {light ? (
            <>
              <circle cx="12" cy="12" r="4" fill="#e9a23b" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          ) : (
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="#e9c46a" />
          )}
        </motion.svg>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-medium">{light ? "Light" : "Dark"}</span>
        <span className={cn("grid h-5 w-5 place-items-center rounded-full border-2", selected ? "border-accent-line" : "border-line-strong")}>
          <AnimatePresence>
            {selected && <motion.span className="h-2.5 w-2.5 rounded-full bg-accent" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} />}
          </AnimatePresence>
        </span>
      </div>
    </motion.button>
  );
}

function Feedback({ msg }: { msg: { ok: boolean; text: string; n: number } | null }) {
  return (
    <AnimatePresence mode="wait">
      {msg && (
        <motion.p
          key={msg.n}
          role={msg.ok ? "status" : "alert"}
          initial={{ opacity: 0, y: -4 }}
          animate={msg.ok ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, x: [0, -6, 6, -3, 0] }}
          exit={{ opacity: 0 }}
          className={cn("text-sm", msg.ok ? "text-success" : "text-danger")}
        >
          {msg.text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
