"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddressForm, emptyAddress, type AddressDraft, type AddressErrors } from "@/components/checkout/Delivery";
import { addressSchema } from "@/lib/checkout/schema";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark";
export type DetailsProfile = { email: string; name: string; phone: string; theme: Theme | null; address: AddressDraft | null; news: boolean };

const input =
  "h-12 w-full rounded-xl border border-[var(--sea-wake)]/30 bg-bg/70 px-4 text-base text-fg outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]";

async function send(method: "POST" | "PATCH", url: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  return { ok: !!res?.ok, error: (data.error as string | undefined) ?? (res ? "Something went wrong. Please try again." : "You seem to be offline. Please try again.") };
}

/**
 * Their details, edited right where they read them: each line shows what's
 * saved, and tapping Edit turns it into a field in place. Enter saves, Escape
 * backs out. Checkout fills in from these.
 */
export function DetailsInPlace({ profile, current }: { profile: DetailsProfile; current: Theme }) {
  const [name, setName] = useState(profile.name);
  return (
    <dl className="max-w-2xl divide-y divide-[var(--sea-wake)]/15 border-y border-[var(--sea-wake)]/15">
      <TextRow label="Name" value={name} field="name" autoComplete="name" placeholder="Your full name" empty="Not added yet" onSaved={setName} />
      <TextRow label="Phone" value={profile.phone} field="phone" type="tel" autoComplete="tel" placeholder="604 555 0123" empty="Not added yet" />
      <EmailRow email={profile.email} />
      <AddressRow initial={profile.address} name={name} />
      <ThemeRow initial={profile.theme ?? current} />
      <NewsRow initial={profile.news} />
    </dl>
  );
}

/** One line: label on the left, what's saved (or the field) on the right, and the Edit link. */
function Row({ label, editing, onEdit, children, saved }: { label: string; editing: boolean; onEdit?: () => void; children: React.ReactNode; saved?: number }) {
  return (
    <div className="grid gap-1 py-5 sm:grid-cols-[140px_1fr_auto] sm:items-start sm:gap-6">
      <dt className="pt-0.5 text-sm text-faint">{label}</dt>
      <dd className="min-w-0">{children}</dd>
      <div className="flex items-center gap-3 sm:justify-end sm:pt-0.5">
        <Saved n={saved} />
        {onEdit && !editing && (
          <button type="button" onClick={onEdit} className="text-sm font-medium text-accent-text underline-offset-4 hover:underline">
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

/** A tick that pops in after each save, then fades on its own (a new save replays it). */
function Saved({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <motion.span
      key={n}
      role="status"
      className="flex items-center gap-1 text-sm font-medium text-success"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 1] }}
      transition={{ duration: 2.2, times: [0, 0.1, 0.8, 1] }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12l5 5 9-10" />
      </svg>
      Saved
    </motion.span>
  );
}

function ErrorText({ text }: { text: string }) {
  return (
    <motion.p role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} className="mt-2 text-sm text-danger">
      {text}
    </motion.p>
  );
}

function Actions({ busy, onCancel, label = "Save", extra }: { busy: boolean; onCancel: () => void; label?: string; extra?: React.ReactNode }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button type="submit" disabled={busy} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink transition-transform active:scale-95 disabled:opacity-60">
        {busy ? "Saving…" : label}
      </button>
      <button type="button" onClick={onCancel} className="rounded-full px-3 py-2 text-sm text-muted hover:text-fg">
        Cancel
      </button>
      {extra}
    </div>
  );
}

const slide = { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 6 }, transition: { duration: 0.18 } };

function TextRow({ label, value: start, field, empty, onSaved, ...attrs }: { label: string; value: string; field: "name" | "phone"; empty: string; onSaved?: (v: string) => void } & Pick<React.InputHTMLAttributes<HTMLInputElement>, "type" | "autoComplete" | "placeholder">) {
  const [value, setValue] = useState(start);
  const [draft, setDraft] = useState(start);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (draft.trim() === value.trim()) return setEditing(false);
    setBusy(true);
    const r = await send("PATCH", "/api/account/me", { [field]: draft });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setValue(draft.trim());
    onSaved?.(draft.trim());
    setEditing(false);
    setSaved((n) => n + 1);
  }
  const cancel = () => (setDraft(value), setError(""), setEditing(false));

  return (
    <Row label={label} editing={editing} onEdit={() => setEditing(true)} saved={saved}>
      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.form key="edit" {...slide} onSubmit={save} onKeyDown={(e) => e.key === "Escape" && cancel()}>
            <input {...attrs} autoFocus value={draft} onChange={(e) => (setDraft(e.target.value), setError(""))} className={input} maxLength={field === "name" ? 120 : 40} aria-label={label} />
            {error && <ErrorText text={error} />}
            <Actions busy={busy} onCancel={cancel} />
          </motion.form>
        ) : (
          <motion.p key="show" {...slide} className={cn("break-words text-lg", !value && "text-faint")}>
            {value || empty}
          </motion.p>
        )}
      </AnimatePresence>
    </Row>
  );
}

/** Email: a code goes to the new address before the account moves over. */
function EmailRow({ email }: { email: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"show" | "new" | "code">("show");
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(0);
  const cancel = () => (setStep("show"), setError(""), setCode(""));

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await send("POST", "/api/account/email", { email: next });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setError("");
    setStep("code");
  }
  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await send("POST", "/api/account/email/confirm", { email: next, code });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    cancel();
    setSaved((n) => n + 1);
    router.refresh();
  }

  return (
    <Row label="Email" editing={step !== "show"} onEdit={() => (setStep("new"), setNext(""))} saved={saved}>
      <AnimatePresence mode="wait" initial={false}>
        {step === "show" && (
          <motion.div key="show" {...slide}>
            <p className="break-all text-lg">{email}</p>
            <p className="text-xs text-faint">You sign in with this, and receipts go here.</p>
          </motion.div>
        )}
        {step === "new" && (
          <motion.form key="new" {...slide} onSubmit={sendCode} onKeyDown={(e) => e.key === "Escape" && cancel()}>
            <input type="email" autoComplete="email" autoFocus required placeholder="New email" value={next} onChange={(e) => (setNext(e.target.value), setError(""))} className={input} aria-label="New email" />
            <p className="mt-2 text-xs text-faint">We&apos;ll email a code to the new address to make sure it&apos;s yours. Your orders and points come with you.</p>
            {error && <ErrorText text={error} />}
            <Actions busy={busy} onCancel={cancel} label={busy ? "Sending…" : "Send code"} />
          </motion.form>
        )}
        {step === "code" && (
          <motion.form key="code" {...slide} onSubmit={confirm} onKeyDown={(e) => e.key === "Escape" && cancel()}>
            <p className="text-sm text-muted">
              Enter the 6-digit code we sent to <strong className="text-fg">{next}</strong>.
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => (setCode(e.target.value.replace(/\D/g, "").slice(0, 6)), setError(""))}
              className={cn(input, "mt-3 max-w-56 text-center font-mono text-2xl tracking-[0.4em]")}
              aria-label="Code"
            />
            {error && <ErrorText text={error} />}
            <Actions busy={busy} onCancel={cancel} label={busy ? "Checking…" : "Confirm"} />
          </motion.form>
        )}
      </AnimatePresence>
    </Row>
  );
}

const oneLine = (a: AddressDraft) => [a.name, [a.line1, a.line2].filter(Boolean).join(", "), `${a.city}, ${a.province} ${a.postal}`].filter(Boolean);

/** Shipping address: shown as it'd go on the box; the full form opens in place. */
function AddressRow({ initial, name }: { initial: AddressDraft | null; name: string }) {
  const [saved, setSavedAddress] = useState<AddressDraft | null>(initial);
  const [draft, setDraft] = useState<AddressDraft>(initial ?? { ...emptyAddress, name });
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const edit = () => (setDraft(saved ?? { ...emptyAddress, name }), setErrors({}), setError(""), setEditing(true));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = addressSchema.safeParse(draft);
    if (!r.success) {
      const next: AddressErrors = {};
      for (const issue of r.error.issues) next[issue.path[0] as keyof AddressDraft] ??= issue.message;
      return setErrors(next);
    }
    setBusy(true);
    const res = await send("PATCH", "/api/account/me", { address: r.data });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSavedAddress({ ...r.data, line2: r.data.line2 ?? "" });
    setEditing(false);
    setTick((n) => n + 1);
  }
  async function remove() {
    setBusy(true);
    const res = await send("PATCH", "/api/account/me", { address: null });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSavedAddress(null);
    setEditing(false);
    setTick((n) => n + 1);
  }

  return (
    <Row label="Shipping address" editing={editing} onEdit={edit} saved={tick}>
      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.form key="edit" {...slide} onSubmit={save} onKeyDown={(e) => e.key === "Escape" && setEditing(false)}>
            <AddressForm
              value={draft}
              onChange={(k, v) => {
                setDraft((a) => ({ ...a, [k]: v }));
                setErrors((x) => ({ ...x, [k]: undefined }));
              }}
              errors={errors}
            />
            {error && <ErrorText text={error} />}
            <Actions
              busy={busy}
              onCancel={() => setEditing(false)}
              extra={
                saved && (
                  <button type="button" onClick={() => void remove()} disabled={busy} className="ml-auto text-sm text-danger underline-offset-4 hover:underline">
                    Remove address
                  </button>
                )
              }
            />
          </motion.form>
        ) : saved ? (
          <motion.address key="show" {...slide} className="not-italic">
            {oneLine(saved).map((l) => (
              <span key={l} className="block text-lg leading-snug">
                {l}
              </span>
            ))}
            <span className="mt-1 block text-xs text-faint">Filled in at checkout when you choose shipping.</span>
          </motion.address>
        ) : (
          <motion.p key="none" {...slide} className="text-lg text-faint">
            None saved. Add one and checkout fills it in.
          </motion.p>
        )}
      </AnimatePresence>
    </Row>
  );
}

/** Light or dark: a switch that slides the sun or the moon across, saved straight away. */
function ThemeRow({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const dark = theme === "dark";

  async function flip() {
    const t: Theme = dark ? "light" : "dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    const r = await send("PATCH", "/api/account/me", { theme: t });
    if (!r.ok) return setError(r.error);
    setError("");
    setTick((n) => n + 1);
  }

  return (
    <Row label="Look" editing={false} saved={tick}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          role="switch"
          aria-checked={dark}
          aria-label="Dark mode"
          onClick={() => void flip()}
          className={cn("relative h-10 w-20 shrink-0 rounded-full border transition-colors", dark ? "border-[var(--sea-wake)]/30 bg-[#0b1622]" : "border-sky-200 bg-sky-100")}
        >
          <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} className={cn("absolute top-1 grid h-8 w-8 place-items-center rounded-full", dark ? "right-1 bg-[#1d2f44]" : "left-1 bg-white")}>
            <motion.svg key={theme} width="20" height="20" viewBox="0 0 24 24" initial={{ rotate: -90, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 16 }} aria-hidden>
              {dark ? (
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="#e9c46a" />
              ) : (
                <g fill="none" stroke="#e9a23b" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" fill="#e9a23b" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </g>
              )}
            </motion.svg>
          </motion.span>
        </button>
        <div>
          <p className="text-lg">{dark ? "Dark" : "Light"}</p>
          <p className="text-xs text-faint">Follows you to every device you sign in on.</p>
        </div>
      </div>
      {error && <ErrorText text={error} />}
    </Row>
  );
}

/** News and offers emails on or off. Order emails always come. */
function NewsRow({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  async function flip() {
    const next = !on;
    setOn(next);
    const r = await send("PATCH", "/api/account/me", { news: next });
    if (!r.ok) return (setOn(!next), setError(r.error));
    setError("");
    setTick((n) => n + 1);
  }
  return (
    <Row label="Emails" editing={false} saved={tick}>
      <div className="flex items-center gap-4">
        <button type="button" role="switch" aria-checked={on} aria-label="News and offers emails" onClick={() => void flip()} className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-surface-strong")}>
          <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow", on ? "right-1" : "left-1")} />
        </button>
        <div>
          <p className="text-lg">{on ? "News and offers on" : "News and offers off"}</p>
          <p className="text-xs text-faint">Sales, new materials and the odd coupon. Order emails always come.</p>
        </div>
      </div>
      {error && <ErrorText text={error} />}
    </Row>
  );
}
