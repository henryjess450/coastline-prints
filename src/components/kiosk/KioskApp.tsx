"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { DrawnCheck, Qr, useForceDark } from "@/components/pos/bits";
import { LightLabLogo } from "@/components/lightlab/LightLabLogo";
import { OneLineLamps } from "@/components/lightlab/hero/OneLineLamps";
import { TinyLamp } from "@/components/lightlab/TinyLamp";
import { buzz } from "@/lib/feel";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import type { KioskSaleView } from "@/lib/kiosk/server";
import type { PosQuote } from "@/lib/pos/types";
import type { ShopProductDto } from "@/lib/shop/types";
import { toCart, type KioskLine } from "./kiosk-cart";
import { Greeting, Steps, type KioskMode } from "./KioskBits";
import { KioskShop } from "./KioskShop";

type Hello = { paired: boolean; pairCode: string | null; name: string; mode: KioskMode; minDate: string };
type Stage = "welcome" | "shop" | "details" | "pay" | "done";
type Done = { kind: "paid"; sale: KioskSaleView } | { kind: "problem"; sale: KioskSaleView };

/** No touches for this long while shopping: "Still there?", then start over. */
const IDLE_MS = 90_000;
const STILL_THERE_S = 20;
/** The QR waits this long before giving up. */
const PAY_IDLE_MS = 5 * 60_000;
/** The thank-you screen goes back to the start after this. */
const DONE_MS = 25_000;

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: body as T } : { ok: false, error: body.error ?? "Something went wrong.", status: res.status };
  } catch {
    return { ok: false, error: "Can't reach the internet. Please ask us at the stand.", status: 0 };
  }
}

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
const ymd = (d: Date) => d.toISOString().slice(0, 10);
function addDaysYmd(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return ymd(new Date(Date.UTC(y, m - 1, d + n)));
}
const prettyDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

/**
 * LightLab self-checkout. A paired tablet at the stand that does one of two
 * things (set in LightLab admin > Kiosk):
 * - "shop": pick lamps, give your name and email, scan the QR and pay on your
 *   own phone. The server rings the sale up once Square says it's paid.
 * - "order": pick lamps (any colour, names too), give your details and the day
 *   you need it, and send an order request. Nothing is charged.
 * Starts over by itself when nobody's using it.
 */
export function KioskApp() {
  useForceDark();
  const [hello, setHello] = useState<Hello | null>(null);
  const [offline, setOffline] = useState(false);
  const [products, setProducts] = useState<ShopProductDto[]>([]);
  const [stage, setStage] = useState<Stage>("welcome");
  const [lines, setLines] = useState<KioskLine[]>([]);
  const [codes, setCodes] = useState<string[]>([]);
  const [quote, setQuote] = useState<PosQuote | null>(null);
  const [details, setDetails] = useState({ name: "", email: "", phone: "", needBy: "", notes: "" });
  const [sale, setSale] = useState<KioskSaleView | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stillThere, setStillThere] = useState<number | null>(null);
  const lastTouch = useRef(0);
  const mode: KioskMode = hello?.mode ?? "shop";
  const order = mode === "order";

  // No sounds at the kiosk: just a light buzz on tablets that allow it.
  const feedback = useCallback((_kind: "click" | "pop" | "chime" | "sparkle", buzzMs?: number) => {
    if (buzzMs) buzz(buzzMs);
  }, []);

  // Pairing, and checking in every minute (the owner can switch the mode or unpair it).
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const r = await api<Hello>("/api/kiosk/hello", { method: "POST" });
      if (stop) return;
      setOffline(!r.ok);
      if (r.ok) setHello(r.data);
      timer = setTimeout(tick, r.ok && r.data.paired ? 60_000 : 3000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);

  // What's for sale, refreshed every couple of minutes (stock changes at the register too).
  const loadProducts = useCallback(async () => {
    const r = await api<{ products: ShopProductDto[] }>("/api/kiosk/products");
    if (r.ok) setProducts(r.data.products);
  }, []);
  useEffect(() => {
    if (!hello?.paired) return;
    const first = setTimeout(loadProducts, 0);
    const t = setInterval(loadProducts, 120_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [hello?.paired, hello?.mode, loadProducts]);

  // The bag's real total from the server, whenever it changes.
  useEffect(() => {
    if (!lines.length) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const r = await api<PosQuote>("/api/kiosk/quote", { method: "POST", body: JSON.stringify(toCart(lines, codes)), signal: ctrl.signal });
      if (r.ok) setQuote(r.data);
    }, 250);
    return () => (clearTimeout(t), ctrl.abort());
  }, [lines, codes]);

  const reset = useCallback(
    async (cancel = true) => {
      if (cancel && sale?.status === "PENDING") void api(`/api/kiosk/sale?id=${sale.id}`, { method: "DELETE" });
      setLines([]);
      setCodes([]);
      setQuote(null);
      setDetails({ name: "", email: "", phone: "", needBy: "", notes: "" });
      setSale(null);
      setDone(null);
      setError(null);
      setStillThere(null);
      setStage("welcome");
      loadProducts();
    },
    [sale, loadProducts],
  );

  // Idle: any touch counts as activity.
  useEffect(() => {
    const touch = () => {
      lastTouch.current = Date.now();
      setStillThere(null);
    };
    touch();
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, []);
  useEffect(() => {
    if (stage === "welcome") return;
    const t = setInterval(() => {
      const idle = Date.now() - lastTouch.current;
      if (stage === "done") return idle > DONE_MS && reset(false);
      if (stage === "pay") return idle > PAY_IDLE_MS && reset();
      if (!lines.length && stage === "shop") return idle > 45_000 && reset();
      if (idle > IDLE_MS + STILL_THERE_S * 1000) return reset();
      if (idle > IDLE_MS) setStillThere(Math.max(0, Math.ceil((IDLE_MS + STILL_THERE_S * 1000 - idle) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [stage, lines.length, reset]);

  // Waiting for the shopper to pay on their phone.
  useEffect(() => {
    if (stage !== "pay" || !sale || sale.status !== "PENDING") return;
    let stop = false;
    const tick = async () => {
      const r = await api<KioskSaleView>(`/api/kiosk/sale?id=${sale.id}`);
      if (stop) return;
      if (r.ok && r.data.status !== "PENDING") {
        setSale(r.data);
        if (r.data.status === "DONE" || r.data.status === "PROBLEM") {
          setDone({ kind: r.data.status === "DONE" ? "paid" : "problem", sale: r.data });
          setStage("done");
          lastTouch.current = Date.now();
          feedback("chime", 40);
        }
        return;
      }
      setTimeout(tick, 2500);
    };
    const t = setTimeout(tick, 2500);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [stage, sale, feedback]);

  const minDate = hello?.minDate ?? addDaysYmd(ymd(new Date()), 7);
  const detailsProblem = !details.name.trim()
    ? "Add your name."
    : !emailOk(details.email)
      ? "Add your email (for your receipt)."
      : order && details.phone.replace(/\D/g, "").length < 7
        ? "Add your phone number."
        : order && (!details.needBy || details.needBy < minDate)
          ? "Pick the day you need it by."
          : null;

  async function submitDetails() {
    if (detailsProblem) return setError(detailsProblem);
    setBusy(true);
    setError(null);
    const customer = order ? { name: details.name, email: details.email, phone: details.phone, notes: details.notes, needBy: details.needBy } : { name: details.name, email: details.email };
    const r = await api<KioskSaleView>("/api/kiosk/sale", { method: "POST", body: JSON.stringify({ cart: toCart(lines, codes), customer }) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSale(r.data);
    setStage("pay");
  }

  async function backFromPay() {
    if (sale?.status === "PENDING") await api(`/api/kiosk/sale?id=${sale.id}`, { method: "DELETE" });
    setSale(null);
    setStage("details");
  }

  const shell = "kiosk lightlab-theme fixed inset-0 z-[200] select-none overflow-hidden bg-bg text-fg [touch-action:manipulation]";

  if (!hello) return <div className={`${shell} grid place-items-center text-muted`}>{offline ? "Can't reach the server. Retrying…" : "Starting…"}</div>;
  if (!hello.paired)
    return (
      <div className={`${shell} grid place-items-center px-6 text-center`}>
        <div>
          <LightLabLogo className="mx-auto h-16" />
          <p className="mt-10 text-lg text-muted">To set up self-checkout, open LightLab admin → Kiosk and enter</p>
          <p className="mt-4 font-mono text-7xl font-bold tracking-[0.3em]">{hello.pairCode}</p>
        </div>
      </div>
    );

  const liveQuote = lines.length ? quote : null;
  const total = liveQuote?.totalCents ?? lines.reduce((n, l) => n + l.unitCents * l.quantity, 0);
  const firstName = details.name.trim().split(/\s+/)[0] ?? "";
  const feeLine = liveQuote?.lines.find((l) => l.key === "card-fee");
  const field = "h-16 w-full rounded-2xl border-2 border-line bg-surface px-5 text-xl outline-none transition-colors focus:border-accent-line";

  return (
    <div className={shell}>
      <AnimatePresence mode="wait" initial={false}>
        {stage === "welcome" && (
          <motion.button key="welcome" type="button" onClick={() => (setStage("shop"), feedback("sparkle", 10))} className="relative grid h-full w-full place-items-center px-8 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.4 }}>
            <div className="relative flex flex-col items-center">
              <LightLabLogo className="h-20 sm:h-28" />
              <div className="mt-4 aspect-[4/5] w-56 sm:w-64">
                <OneLineLamps />
              </div>
              <p className="ll-accent text-5xl">{order ? "order a lamp" : "self-checkout"}</p>
              <motion.p className="mt-6 rounded-full bg-fg px-10 py-5 text-2xl font-bold text-bg shadow-[0_0_40px_rgb(255_217_138/0.25)]" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
                Tap to start
              </motion.p>
              <p className="mt-6 text-lg text-muted">{order ? "Pick your lamp and colours, choose when you need it, and pay on your phone. We make it for you." : "Pick your lamp here, then pay on your phone: card, Apple Pay or Google Pay."}</p>
            </div>
          </motion.button>
        )}

        {stage === "shop" && (
          <motion.div key="shop" className="h-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }}>
            <KioskShop
              mode={mode}
              products={products}
              lines={lines}
              setLines={setLines}
              codes={codes}
              setCodes={setCodes}
              quote={liveQuote}
              total={total}
              onNext={() => (setError(null), setStage("details"))}
              onStartOver={() => reset()}
              feedback={feedback}
            />
          </motion.div>
        )}

        {stage === "details" && (
          <motion.div key="details" className="flex h-full flex-col" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ type: "spring", stiffness: 260, damping: 28 }}>
            <header className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="flex items-center gap-4">
                <LightLabLogo className="h-10" />
                <Steps mode={mode} at={1} />
              </div>
              <span className="flex items-center gap-2 text-muted">
                <TinyLamp on size={26} /> {lines.reduce((n, l) => n + l.quantity, 0)} in your {order ? "order" : "bag"} · {money(total)}
              </span>
            </header>
            <form
              className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-8"
              onSubmit={(e) => {
                e.preventDefault();
                void submitDetails();
              }}
            >
              <Greeting name={details.name} />
              <h1 className="mt-1 font-display text-3xl font-bold">{order ? "Tell us about your order" : "Where should we send your receipt?"}</h1>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <input value={details.name} onChange={(e) => setDetails((d) => ({ ...d, name: e.target.value }))} placeholder="Your name" autoComplete="off" className={field} aria-label="Your name" />
                <div className="relative">
                  <input value={details.email} onChange={(e) => setDetails((d) => ({ ...d, email: e.target.value }))} placeholder="Email" type="email" inputMode="email" autoComplete="off" autoCapitalize="off" className={cn(field, "pr-14")} aria-label="Email" />
                  <AnimatePresence>
                    {emailOk(details.email) && (
                      <motion.span className="absolute right-4 top-1/2 -mt-4 h-8 w-8 text-success" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
                        <DrawnCheck className="h-8 w-8" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                {order && <input value={details.phone} onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))} placeholder="Phone number" type="tel" inputMode="tel" autoComplete="off" className={cn(field, "sm:col-span-2")} aria-label="Phone number" />}
              </div>

              {order && (
                <>
                  <p className="mt-8 text-lg font-semibold">When do you need it?</p>
                  <p className="text-muted">We need at least a week to make it.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {[0, 7, 14, 21].map((n) => {
                      const day = addDaysYmd(minDate, n);
                      const on = details.needBy === day;
                      return (
                        <motion.button key={day} type="button" whileTap={{ scale: 0.94 }} onClick={() => (setDetails((d) => ({ ...d, needBy: day })), feedback("click"))} className={cn("relative rounded-2xl border-2 px-5 py-3 text-left", on ? "border-accent-line" : "border-line")}>
                          {on && <motion.span layoutId="kiosk-day" className="absolute inset-0 rounded-[14px] bg-accent-soft" />}
                          <span className="relative block text-lg font-semibold">{n === 0 ? "In a week" : `In ${n / 7 + 1} weeks`}</span>
                          <span className="relative block text-sm text-muted">{new Date(`${day}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</span>
                        </motion.button>
                      );
                    })}
                    <label className={cn("relative flex items-center rounded-2xl border-2 px-4", details.needBy && ![0, 7, 14, 21].some((n) => addDaysYmd(minDate, n) === details.needBy) ? "border-accent-line" : "border-line")}>
                      <span className="sr-only">Another day</span>
                      <input type="date" min={minDate} value={details.needBy} onChange={(e) => setDetails((d) => ({ ...d, needBy: e.target.value }))} className="h-14 bg-transparent text-lg outline-none [color-scheme:dark]" />
                    </label>
                  </div>
                  {details.needBy && details.needBy >= minDate && (
                    <motion.p key={details.needBy} className="mt-3 text-accent-text" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                      Ready by {prettyDay(details.needBy)}.
                    </motion.p>
                  )}
                  <textarea value={details.notes} onChange={(e) => setDetails((d) => ({ ...d, notes: e.target.value }))} placeholder="Anything else? (optional)" rows={2} maxLength={1000} className="mt-6 w-full rounded-2xl border-2 border-line bg-surface p-4 text-lg outline-none focus:border-accent-line" />
                </>
              )}

              <AnimatePresence>
                {error && (
                  <motion.p key={error} role="alert" className="mt-5 rounded-2xl bg-danger/15 p-4 text-lg text-danger" initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: [0, -10, 10, -6, 6, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="mt-8 flex gap-3">
                <button type="button" onClick={() => setStage("shop")} className="h-16 rounded-full border border-line px-8 text-lg font-semibold">
                  Back
                </button>
                <motion.button type="submit" disabled={busy} whileTap={{ scale: 0.97 }} className={cn("h-16 flex-1 rounded-full text-lg font-bold transition-colors disabled:opacity-60", detailsProblem ? "bg-elev text-muted" : "bg-fg text-bg")}>
                  {busy ? "One moment…" : `Pay ${money(total)} on my phone`}
                </motion.button>
              </div>
              <p className="mt-3 text-center text-sm text-faint">{order ? "We'll email you when it's ready to pick up." : "We only use your email for your receipt."}</p>
            </form>
          </motion.div>
        )}

        {stage === "pay" && sale && (
          <motion.div key="pay" className="relative grid h-full place-items-center px-6 text-center" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="absolute left-6 top-5">
              <Steps mode={mode} at={2} />
            </div>
            <div>
              <p className="font-display text-4xl font-bold">
                {firstName ? `${firstName}, scan` : "Scan"} to pay {money(sale.totalCents)}
              </p>
              <p className="mt-2 text-xl text-muted">Point your phone&apos;s camera at the code. Card, Apple Pay or Google Pay.</p>
              {feeLine?.cents ? (
                <p className="mx-auto mt-3 max-w-md rounded-2xl bg-surface px-4 py-2 text-sm text-muted">
                  Includes a {money(feeLine.cents)} card processing fee. {feeLine.detail}
                </p>
              ) : null}
              <motion.div className="relative mx-auto mt-8 w-80 overflow-hidden rounded-[28px] border-2 border-[#297f9d] bg-white p-3" initial={{ rotate: -6, scale: 0.85 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 15 }}>
                <Qr value={sale.url} className="w-full" />
                {/* A scanner line gliding down and back, eased at both ends so it never snaps. */}
                <motion.span className="absolute inset-x-4 h-1 rounded-full bg-[#297f9d] opacity-80" initial={{ top: "6%" }} animate={{ top: "92%" }} transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }} aria-hidden />
              </motion.div>
              <p className="mt-6 flex items-center justify-center gap-2 text-lg text-muted">
                <motion.span className="h-3 w-3 rounded-full bg-[#297f9d]" animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
                Waiting for your payment
              </p>
              <button type="button" onClick={backFromPay} className="mt-8 h-14 rounded-full border border-line px-8 text-lg font-semibold">
                Back
              </button>
            </div>
          </motion.div>
        )}

        {stage === "done" && done && (
          <motion.button key="done" type="button" onClick={() => reset(false)} className="relative grid h-full w-full place-items-center overflow-hidden px-6 text-center" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            {done.kind === "problem" ? (
              <div className="relative">
                <DrawnCheck className="mx-auto h-28 w-28 text-success" />
                <p className="mt-6 font-display text-3xl font-bold">You&apos;re paid. Please show this screen at the stand.</p>
                <p className="mt-3 text-xl text-muted">{money(done.sale.totalCents)} received. We just need to finish your sale by hand. Sorry for the wait!</p>
              </div>
            ) : (
              <div className="relative">
                <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 12 }} className="mx-auto w-fit text-[#ffd98a]">
                  <TinyLamp on size={140} />
                </motion.div>
                <p className="ll-accent mt-4 text-6xl">thank you{firstName ? `, ${firstName}` : ""}!</p>
                <p className="mt-3 font-display text-3xl font-bold">{order ? "Your order is in!" : "You're all paid. Enjoy your lamp!"}</p>
                <p className="mt-3 text-xl text-muted">
                  {order
                    ? `It'll be ready by ${details.needBy ? prettyDay(details.needBy) : "the day you picked"}. We'll email ${details.email.trim()} when it is.`
                    : done.sale.emailed
                      ? `Your receipt is on its way to ${details.email.trim()}.`
                      : `Receipt ${done.sale.orderNumber}.`}
                </p>
                <p className="mt-2 text-muted">Order {done.sale.orderNumber}</p>
                <p className="mt-10 text-muted">Tap anywhere to finish</p>
              </div>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* "Still there?" before starting over */}
      <AnimatePresence>
        {stillThere != null && stage !== "done" && (
          <motion.div className="fixed inset-0 z-[400] grid place-items-center bg-black/70 px-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-md rounded-[28px] border border-line bg-elev p-8 text-center" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 22 }}>
              <motion.div className="mx-auto w-fit" animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
                <TinyLamp on={stillThere % 2 === 0} size={64} />
              </motion.div>
              <p className="mt-3 font-display text-3xl font-bold">Still there?</p>
              <p className="mt-2 text-lg text-muted">Starting over in {stillThere} seconds.</p>
              <button type="button" className="mt-6 h-16 w-full rounded-full bg-fg text-lg font-bold text-bg">
                I&apos;m still here!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
