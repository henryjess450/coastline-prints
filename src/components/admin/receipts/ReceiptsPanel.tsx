"use client";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { cancelPrintJobAction, newBridgeKeyAction, retryPrintJobAction, saveReceiptSettingsAction, testPrintAction } from "@/app/admin/receipt-actions";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { MARKET_ART, RECEIPT_SEASONS, SEASON_MESSAGES, type Market, type PrintSettings } from "@/lib/receipt/themes";
import type { SeasonId } from "@config/seasons";

type Bridge = { online: boolean; agoMin: number | null; printer: "ok" | "missing" | null; printerHost: string | null; version: string | null; keyMadeAt: string | null };
type Job = { id: string; label: string; status: string; error: string | null; /** Already formatted in shop time. */ createdAt: string };
type Slip = "receipt" | "gift" | "claim";

const field = "h-11 w-full rounded-xl border-2 border-line bg-surface px-3 text-sm focus:border-accent-line focus:outline-none";
const label = "text-xs font-semibold uppercase tracking-[0.14em] text-muted";
const SLIPS: { value: Slip; label: string }[] = [
  { value: "receipt", label: "Receipt" },
  { value: "gift", label: "Gift receipt" },
  { value: "claim", label: "Order ticket" },
];
const STATUS: Record<string, string> = { QUEUED: "Waiting", SENT: "Printing", PRINTED: "Printed", FAILED: "Didn't print", CANCELLED: "Cancelled" };
const seasonName = (id: string) => RECEIPT_SEASONS.find((s) => s.id === id)?.name ?? id;

export function ReceiptsPanel({ settings: saved, seasonNow, bridge, destination, homePrinter, jobs, site }: { settings: PrintSettings; seasonNow: SeasonId; bridge: Bridge; destination: "bridge" | "home"; homePrinter: string | null; jobs: Job[]; site: string }) {
  const router = useRouter();
  const [settings, setSettings] = useState(saved);
  const [saving, startSave] = useTransition();
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  // Keep the bridge's online dot and the print list fresh (not while editing).
  useEffect(() => {
    if (dirty) return;
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [router, dirty]);

  const save = (next = settings) =>
    startSave(async () => {
      const r = await saveReceiptSettingsAction(next);
      if (r.error) toast(r.error, "error");
      else {
        toast(r.message ?? "Saved.");
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Receipts</h1>
        <p className="mt-1 text-sm text-muted">
          Tickets print {destination === "bridge" ? "through the print bridge" : `on the home printer (${homePrinter})`}. The LightLab stand&apos;s receipts are decorated for{" "}
          <span className="font-semibold text-fg">{seasonName(seasonNow)}</span>.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <PrinterCard
            bridge={bridge}
            route={settings.route}
            homePrinter={homePrinter}
            onRoute={(route) => {
              const next = { ...saved, route };
              setSettings({ ...settings, route });
              save(next);
            }}
          />
          <SeasonCard settings={settings} setSettings={setSettings} seasonNow={seasonNow} />
          <MarketsCard markets={settings.markets} footer={settings.footer} setMarkets={(markets) => setSettings({ ...settings, markets })} setFooter={(footer) => setSettings({ ...settings, footer })} />
          <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3">
            {dirty && <span className="rounded-full bg-surface px-3 py-1 text-sm text-muted shadow">Unsaved changes</span>}
            {dirty && (
              <button type="button" onClick={() => setSettings(saved)} className={buttonClass("secondary")}>
                Undo
              </button>
            )}
            <motion.button type="button" disabled={!dirty || saving} whileTap={{ scale: 0.95 }} onClick={() => save()} className={buttonClass("primary")}>
              {saving ? "Saving…" : "Save receipts"}
            </motion.button>
          </div>
          <PairCard keyMadeAt={bridge.keyMadeAt} site={site} />
          <JobsCard jobs={jobs} />
        </div>
        <PreviewCard settings={settings} saved={saved} />
      </div>
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", on ? "bg-success" : "bg-line-strong")} aria-hidden />;
}

function PrinterCard({ bridge, route, homePrinter, onRoute }: { bridge: Bridge; route: PrintSettings["route"]; homePrinter: string | null; onRoute: (r: PrintSettings["route"]) => void }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Printer</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        <li className="flex items-center gap-2">
          <Dot on={bridge.online} />
          {bridge.keyMadeAt ? (bridge.online ? "Print bridge is online" : bridge.agoMin != null ? `Print bridge last seen ${bridge.agoMin} min ago` : "Print bridge is offline") : "No print bridge set up yet"}
          {bridge.version && <span className="text-faint">v{bridge.version}</span>}
        </li>
        {bridge.online && (
          <li className="flex items-center gap-2">
            <Dot on={bridge.printer === "ok"} />
            {bridge.printer === "ok" ? `It can reach the printer${bridge.printerHost ? ` at ${bridge.printerHost}` : ""}` : "It can't find the printer. Check the ethernet cable and that the printer is on."}
          </li>
        )}
        <li className="flex items-center gap-2">
          <Dot on={!!homePrinter} />
          {homePrinter ? `Home printer at ${homePrinter}` : "No home printer (RECEIPT_PRINTER_HOST isn't set)"}
        </li>
      </ul>
      <div className="mt-4">
        <p className={label}>Send tickets to</p>
        <div className="mt-2 max-w-md">
          <Segmented
            label="Send tickets to"
            value={route}
            onChange={onRoute}
            options={[
              { value: "auto", label: "Automatic" },
              { value: "bridge", label: "Print bridge" },
              { value: "home", label: "Home printer" },
            ]}
          />
        </div>
        <p className="mt-2 text-xs text-muted">Automatic uses the bridge whenever it&apos;s online, so plugging it in at the stand is all it takes. While it&apos;s online, tickets for online orders print there too.</p>
      </div>
    </Card>
  );
}

function SeasonCard({ settings, setSettings, seasonNow }: { settings: PrintSettings; setSettings: (s: PrintSettings) => void; seasonNow: SeasonId }) {
  const editing = (settings.season === "auto" || settings.season === "site" ? seasonNow : settings.season) as SeasonId;
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Season</h2>
      <p className="mt-1 text-sm text-muted">Decorations along the top and a little scene near the bottom, plus a greeting.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={label}>Decorate for</span>
          <select className={field} value={settings.season} onChange={(e) => setSettings({ ...settings, season: e.target.value })}>
            <option value="auto">By the calendar (Christmas from Nov 15)</option>
            <option value="site">Same as the website&apos;s theme</option>
            {RECEIPT_SEASONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {editing !== "coastline" && (
          <label className="grid gap-1.5">
            <span className={label}>{seasonName(editing)} greeting</span>
            <input
              className={field}
              maxLength={120}
              value={settings.seasonMessages[editing] ?? SEASON_MESSAGES[editing]}
              onChange={(e) => setSettings({ ...settings, seasonMessages: { ...settings.seasonMessages, [editing]: e.target.value } })}
            />
          </label>
        )}
      </div>
    </Card>
  );
}

const slug = (name: string, taken: string[]) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "market";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
};

function MarketsCard({ markets, footer, setMarkets, setFooter }: { markets: Market[]; footer: string; setMarkets: (m: Market[]) => void; setFooter: (f: string) => void }) {
  const update = (i: number, patch: Partial<Market>) => setMarkets(markets.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Markets</h2>
      <p className="mt-1 text-sm text-muted">Pick today&apos;s market on the register (next to Selling as). Its name, drawing and message go on the receipt, and the sale shows under that market on Sources.</p>
      <ul className="mt-4 space-y-4">
        {markets.map((m, i) => (
          <li key={m.id} className="rounded-2xl border-2 border-line p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} aria-label="Market name" placeholder="Market name" maxLength={40} value={m.name} onChange={(e) => update(i, { name: e.target.value })} />
              <input className={field} aria-label="Where or when" placeholder="Where or when, e.g. Saturdays in the square" maxLength={50} value={m.place} onChange={(e) => update(i, { place: e.target.value })} />
              <input className={cn(field, "sm:col-span-2")} aria-label="Message" placeholder="Message, e.g. See you next weekend!" maxLength={120} value={m.message} onChange={(e) => update(i, { message: e.target.value })} />
              <select className={field} aria-label="Drawing" value={m.art} onChange={(e) => update(i, { art: e.target.value as Market["art"] })}>
                {MARKET_ART.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}: {a.hint}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setMarkets(markets.filter((_, j) => j !== i))} className="justify-self-end text-sm text-muted underline-offset-4 hover:text-danger hover:underline">
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setMarkets([...markets, { id: slug(`market ${markets.length + 1}`, markets.map((m) => m.id)), name: "", place: "", message: "", art: "harbour" }])}
        className={cn(buttonClass("secondary", "sm"), "mt-3")}
        disabled={markets.length >= 30}
      >
        Add a market
      </button>
      <label className="mt-5 grid gap-1.5">
        <span className={label}>Message when the market has none</span>
        <input className={field} maxLength={120} value={footer} onChange={(e) => setFooter(e.target.value)} />
      </label>
    </Card>
  );
}

function PreviewCard({ settings, saved }: { settings: PrintSettings; saved: PrintSettings }) {
  const [slip, setSlip] = useState<Slip>("receipt");
  const [marketId, setMarketId] = useState<string>(settings.markets[0]?.id ?? "");
  const [season, setSeason] = useState<string>("");
  const [printing, startPrint] = useTransition();
  const market = settings.markets.find((m) => m.id === marketId) ?? null;
  // Unsaved edits show straight away: the market and greeting go along in the address.
  const src = useMemo(() => {
    const q = new URLSearchParams({ slip, season: season || settings.season });
    if (market?.name) Object.entries({ name: market.name, place: market.place, message: market.message, art: market.art }).forEach(([k, v]) => q.set(k, v));
    q.set("v", JSON.stringify(settings.seasonMessages).length + settings.footer);
    return `/api/admin/receipts/preview?${q}`;
  }, [slip, season, settings.season, settings.seasonMessages, settings.footer, market]);
  const [debounced, setDebounced] = useState(src);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(src), 400);
    return () => clearTimeout(t);
  }, [src]);
  const savedMarket = saved.markets.some((m) => m.id === marketId);

  return (
    <Card className="h-fit p-5 lg:sticky lg:top-4">
      <h2 className="font-display text-lg font-semibold">Preview</h2>
      <div className="mt-3 grid gap-2">
        <select className={field} aria-label="Slip" value={slip} onChange={(e) => setSlip(e.target.value as Slip)}>
          {SLIPS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select className={field} aria-label="Market" value={marketId} onChange={(e) => setMarketId(e.target.value)}>
            <option value="">No market</option>
            {settings.markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || "(no name)"}
              </option>
            ))}
          </select>
          <select className={field} aria-label="Season" value={season} onChange={(e) => setSeason(e.target.value)}>
            <option value="">Season as set</option>
            {RECEIPT_SEASONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={debounced} alt="How the slip prints" className="mx-auto w-full max-w-[288px]" />
      </div>
      <p className="mt-2 text-xs text-muted">A made-up order, shown exactly as the printer prints it (72 mm wide).</p>
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        disabled={printing}
        onClick={() =>
          startPrint(async () => {
            const r = await testPrintAction(slip, savedMarket ? marketId : null, season || null);
            toast(r.error ?? r.message ?? "Sent.", r.error ? "error" : "success");
          })
        }
        className={cn(buttonClass("primary"), "mt-3 w-full")}
      >
        {printing ? "Sending…" : "Print a test"}
      </motion.button>
      {!savedMarket && marketId && <p className="mt-2 text-xs text-muted">Save to use this market on a test print.</p>}
    </Card>
  );
}

function PairCard({ keyMadeAt, site }: { keyMadeAt: string | null; site: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, what: string) => void navigator.clipboard.writeText(text).then(() => setCopied(what));
  const pi = key ? `curl -fsSL ${site}/print-bridge/setup-pi.sh | sudo bash -s -- ${key}` : null;
  const mac = key ? `curl -fsSLO ${site}/print-bridge/print-bridge.mjs && BRIDGE_KEY=${key} node print-bridge.mjs` : null;
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Set up the print bridge</h2>
      <p className="mt-1 text-sm text-muted">The printer has no Wi-Fi, so at the stand it plugs into a small computer by ethernet. That computer joins your phone&apos;s hotspot and prints whatever the register sends. The iPad doesn&apos;t need anything installed.</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
        <li>
          <span className="text-fg">Raspberry Pi</span> (a Pi 4, Pi 5 or Pi Zero 2 W with a USB ethernet adapter), on Raspberry Pi OS Lite: make a key below and run the Pi command on it once. It asks for your hotspot&apos;s name and password.
        </li>
        <li>Plug the printer&apos;s ethernet cable into the Pi, power both, and turn on your hotspot. The Pi gives the printer its address itself.</li>
        <li>
          <span className="text-fg">Or a Mac</span> with Node installed: plug the printer into the home network (or the Mac), and run the Mac command.
        </li>
      </ol>
      <p className="mt-3 text-xs text-faint">{keyMadeAt ? `Current key made ${new Date(keyMadeAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}. Making a new one stops the old bridge until it gets the new key.` : "No key made yet."}</p>
      {key ? (
        <div className="mt-4 space-y-3 rounded-2xl border-2 border-accent-line bg-accent-soft p-3">
          <p className={cn(label, "text-accent-text")}>Bridge key (shown once)</p>
          {[
            ["Pi", pi!],
            ["Mac", mac!],
          ].map(([what, cmd]) => (
            <div key={what}>
              <p className="text-xs font-semibold">{what}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-surface px-2 py-1.5 font-mono text-xs">{cmd}</code>
                <button type="button" onClick={() => copy(cmd, what)} className={buttonClass("secondary", "sm")}>
                  {copied === what ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <motion.button
          type="button"
          disabled={pending}
          whileTap={{ scale: 0.95 }}
          onClick={() =>
            start(async () => {
              const r = await newBridgeKeyAction();
              if (r.key) setKey(r.key);
            })
          }
          className={cn(buttonClass(keyMadeAt ? "secondary" : "primary"), "mt-4")}
        >
          {keyMadeAt ? "Make a new bridge key" : "Make a bridge key"}
        </motion.button>
      )}
    </Card>
  );
}

function JobsCard({ jobs }: { jobs: Job[] }) {
  const [, start] = useTransition();
  const router = useRouter();
  const act = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.error) toast(r.error, "error");
      else if (r.message) toast(r.message);
      router.refresh();
    });
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Sent to the bridge</h2>
      {jobs.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line text-sm">
          {jobs.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="font-semibold">{j.label}</span>
                <span className={cn(" ", j.status === "FAILED" ? "text-danger" : "text-muted")}> · {STATUS[j.status] ?? j.status}</span>
                <span className="text-faint"> · {j.createdAt}</span>
                {j.error && <span className="block text-xs text-danger">{j.error}</span>}
              </span>
              <span className="flex gap-3">
                {(j.status === "FAILED" || j.status === "SENT" || j.status === "QUEUED") && (
                  <button type="button" className="text-accent-text underline-offset-4 hover:underline" onClick={() => act(() => retryPrintJobAction(j.id))}>
                    Print again
                  </button>
                )}
                {(j.status === "QUEUED" || j.status === "SENT") && (
                  <button type="button" className="text-muted underline-offset-4 hover:underline" onClick={() => act(() => cancelPrintJobAction(j.id))}>
                    Cancel
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
