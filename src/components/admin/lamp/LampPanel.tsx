"use client";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/app/admin/actions";
import { newLampKeyAction, playLampAction, saveLampSettingsAction, testSaleAction, type LampKeyState } from "@/app/admin/lamp-actions";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { LAMP_ANIMS, LAMP_ANIM_IDS, type LampAnim } from "@/lib/lamp/animations";
import { LampRing } from "./LampRing";

type Settings = {
  brightness: number;
  idle: "off" | "calm";
  play: Record<"print" | "coastline" | "lightlab" | "gift", string>;
  bigCents: number;
  bigAnim: string;
  count: boolean;
  quiet: { on: boolean; from: number; to: number };
};

export type LampStatus = { online: boolean; agoMin: number | null; rssi: number | null; version: string | null };
export type LampPlay = { id: number; anim: string; value?: number | null; reason: string; at: string };

const SALES: { key: keyof Settings["play"]; label: string }[] = [
  { key: "print", label: "Custom print order" },
  { key: "coastline", label: "Coastline shop order" },
  { key: "lightlab", label: "LightLab order" },
  { key: "gift", label: "Gift card" },
];
const REASONS: Record<string, string> = { print: "Print order", coastline: "Coastline shop", lightlab: "LightLab", gift: "Gift card", dash: "Played from here", test: "Test sale" };

const hourLabel = (h: number) => new Date(2026, 0, 1, h).toLocaleTimeString("en-CA", { hour: "numeric" });
const field = "h-11 w-full rounded-xl border-2 border-line bg-surface px-3 text-sm focus:border-accent-line focus:outline-none";
const animName = (id: string) => LAMP_ANIMS[id as LampAnim]?.name ?? id;

export function LampPanel({ settings, quietNow, status, plays, keyMadeAt, site }: { settings: Settings; quietNow: boolean; status: LampStatus; plays: LampPlay[]; keyMadeAt: string | null; site: string }) {
  const router = useRouter();
  // Keep the online dot and the list of plays fresh.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-5">
        <LampRing anim={quietNow ? "off" : settings.idle === "calm" && status.online ? "calm" : "tide"} size={88} />
        <div>
          <h1 className="font-display text-3xl font-bold">Order lamp</h1>
          <StatusLine status={status} paired={!!keyMadeAt} />
          {quietNow && (
            <p className="mt-1 text-sm text-muted">
              <span className="font-semibold text-fg">Quiet hours until {hourLabel(settings.quiet.to)}.</span> Orders won&apos;t light the lamp and the glow is off. Play still works.
            </p>
          )}
        </div>
      </header>

      <PlayCard />
      <SettingsCard settings={settings} />
      <TestSaleCard />
      <div className="grid gap-6 lg:grid-cols-2">
        <PairCard keyMadeAt={keyMadeAt} site={site} />
        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Recently played</h2>
          {plays.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing yet. Tap Play above, or wait for an order.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {plays.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-semibold">{animName(p.anim)}</span>
                    {p.value ? <span className="tabular-nums"> ${p.value}</span> : null} <span className="text-muted">· {REASONS[p.reason] ?? p.reason}</span>
                  </span>
                  <time className="shrink-0 text-xs text-faint">{new Date(p.at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatusLine({ status, paired }: { status: LampStatus; paired: boolean }) {
  const ago = status.agoMin;
  const signal = status.rssi == null ? null : status.rssi > -60 ? "strong" : status.rssi > -72 ? "okay" : "weak";
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
      <span className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {status.online && (
            <motion.span
              className="absolute inset-0 rounded-full bg-success"
              animate={{ scale: [1, 1.8, 2.6], opacity: [0, 0.45, 0] }}
              transition={{ duration: 2.2, times: [0, 0.25, 1], repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <span className={cn("relative h-2.5 w-2.5 rounded-full", status.online ? "bg-success" : "bg-faint")} />
        </span>
        <span className="font-semibold text-fg">{status.online ? "Lamp is on and listening" : paired ? "Lamp is offline" : "No lamp paired yet"}</span>
      </span>
      {!status.online && ago != null && <span>last heard {ago < 1 ? "just now" : ago < 120 ? `${ago} min ago` : `${Math.round(ago / 60)} h ago`}</span>}
      {status.online && signal && <span>Wi-Fi {signal} ({status.rssi} dBm)</span>}
    </p>
  );
}

function PlayCard() {
  const [state, action, pending] = useActionState<ActionState, FormData>(playLampAction, {});
  const [dollars, setDollars] = useState(7);
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Play on the lamp</h2>
      <p className="mt-1 text-sm text-muted">Each one starts and ends dark. Tap Play and the lamp runs it within a second.</p>
      <form action={action} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LAMP_ANIM_IDS.map((id) => (
          <div key={id} className="flex items-center gap-4 rounded-2xl border-2 border-line p-3">
            <LampRing anim={id} value={dollars} size={76} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{LAMP_ANIMS[id].name}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted">{LAMP_ANIMS[id].blurb}</p>
              <div className="mt-2 flex items-center gap-2">
                <motion.button type="submit" name="anim" value={id} disabled={pending} whileTap={{ scale: 0.94 }} className={buttonClass("secondary", "sm")}>
                  Play
                </motion.button>
                {id === "payment" && (
                  <label className="flex items-center gap-1 text-sm text-muted">
                    $
                    <input
                      name="dollars"
                      type="number"
                      min={1}
                      max={48}
                      value={dollars}
                      onChange={(e) => setDollars(Math.min(48, Math.max(1, Math.round(Number(e.target.value)) || 1)))}
                      aria-label="Dollars to count"
                      className="h-9 w-16 rounded-full border-2 border-line bg-surface px-3 text-sm text-fg tabular-nums focus:border-accent-line focus:outline-none"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        ))}
      </form>
      {(state.message || state.error) && !pending && <p className={cn("mt-4 text-sm", state.error ? "text-danger" : "text-success")}>{state.error ?? state.message}</p>}
    </Card>
  );
}

function SettingsCard({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveLampSettingsAction, {});
  const [brightness, setBrightness] = useState(settings.brightness);
  const [quiet, setQuiet] = useState(settings.quiet.on);
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, label: hourLabel(h) }));
  const animSelect = (name: string, value: string) => (
    <select name={name} defaultValue={value} className={field}>
      {LAMP_ANIM_IDS.map((id) => (
        <option key={id} value={id}>
          {LAMP_ANIMS[id].name}
        </option>
      ))}
    </select>
  );
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">When something sells</h2>
      <p className="mt-1 text-sm text-muted">The lamp plays as soon as an order is paid, by card or e-Transfer.</p>
      <form action={action} className="mt-5 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SALES.map((s) => (
            <label key={s.key} className="block text-sm font-medium">
              {s.label}
              <div className="mt-1.5">{animSelect(`play.${s.key}`, settings.play[s.key])}</div>
            </label>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Big orders (this much or more, $)
            <input name="bigDollars" type="number" min={0} step={1} defaultValue={settings.bigCents ? settings.bigCents / 100 : ""} placeholder="Never" className={cn(field, "mt-1.5")} />
          </label>
          <label className="block text-sm font-medium">
            ...then also play
            <div className="mt-1.5">{animSelect("bigAnim", settings.bigAnim)}</div>
          </label>
        </div>

        <label className="flex items-center gap-3 text-sm font-medium">
          <input name="count" type="checkbox" defaultChecked={settings.count} className="h-5 w-5 accent-[var(--accent-line)]" />
          Then play Payment: one light per dollar the sale made (shipping left out)
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Brightness <span className="tabular-nums text-muted">{brightness}%</span>
            <input name="brightness" type="range" min={5} max={100} step={5} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="mt-3 w-full accent-[var(--accent-line)]" />
          </label>
          <label className="block text-sm font-medium">
            Between orders
            <select name="idle" defaultValue={settings.idle} className={cn(field, "mt-1.5")}>
              <option value="off">Off (dark)</option>
              <option value="calm">Calm sea (a slow, dim navy glow)</option>
            </select>
          </label>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input name="quiet.on" type="checkbox" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} className="h-5 w-5 accent-[var(--accent-line)]" />
            Quiet hours (orders don&apos;t light the lamp and the glow goes off; Play here still works)
          </label>
          <div className={cn("flex flex-wrap items-center gap-2 text-sm", !quiet && "opacity-50")}>
            From
            <select name="quiet.from" defaultValue={settings.quiet.from} disabled={!quiet} className={cn(field.replace("w-full", "w-36"))}>
              {hours.map((o) => (
                <option key={o.h} value={o.h}>
                  {o.label}
                </option>
              ))}
            </select>
            to
            <select name="quiet.to" defaultValue={settings.quiet.to} disabled={!quiet} className={cn(field.replace("w-full", "w-36"))}>
              {hours.map((o) => (
                <option key={o.h} value={o.h}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {/* Disabled selects aren't submitted: keep the hours when quiet hours are off. */}
          {!quiet && (
            <>
              <input type="hidden" name="quiet.from" value={settings.quiet.from} />
              <input type="hidden" name="quiet.to" value={settings.quiet.to} />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <motion.button type="submit" disabled={pending} whileTap={{ scale: 0.95 }} className={buttonClass("primary")}>
            {pending ? "Saving..." : "Save"}
          </motion.button>
          {(state.message || state.error) && !pending && <p className={cn("text-sm", state.error ? "text-danger" : "text-success")}>{state.error ?? state.message}</p>}
        </div>
      </form>
    </Card>
  );
}

function TestSaleCard() {
  const [state, action, pending] = useActionState<ActionState, FormData>(testSaleAction, {});
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Try a sale</h2>
      <p className="mt-1 text-sm text-muted">Plays exactly what a real order would right now, using the settings above (save them first). Nothing is charged or emailed.</p>
      <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
        <select name="kind" defaultValue="print" aria-label="Kind of sale" className={field.replace("w-full", "w-56")}>
          {SALES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          $
          <input name="dollars" type="number" min={1} max={10000} defaultValue={25} aria-label="Sale amount in dollars" className={field.replace("w-full", "w-24")} />
        </label>
        <motion.button type="submit" disabled={pending} whileTap={{ scale: 0.95 }} className={buttonClass("secondary")}>
          Try it
        </motion.button>
      </form>
      {(state.message || state.error) && !pending && <p className={cn("mt-3 text-sm", state.error ? "text-danger" : "text-success")}>{state.error ?? state.message}</p>}
    </Card>
  );
}

function PairCard({ keyMadeAt, site }: { keyMadeAt: string | null; site: string }) {
  const [state, action, pending] = useActionState<LampKeyState, FormData>(newLampKeyAction, {});
  const [copied, setCopied] = useState(false);
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Set up the lamp</h2>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
        <li>Plug the ESP32 into the Mac with a USB cable that carries data.</li>
        <li>
          In the project folder, run <code className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-fg">bash scripts/lamp/flash.sh</code>
        </li>
        <li>When it asks for the lamp key, make one here and paste it in.</li>
      </ol>
      <p className="mt-3 text-xs text-faint">
        The lamp talks to {site}. {keyMadeAt ? `Current key made ${new Date(keyMadeAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}.` : "No key made yet."}
      </p>
      {state.key ? (
        <div className="mt-4 rounded-2xl border-2 border-accent-line bg-accent-soft p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">Lamp key (shown once)</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-sm">{state.key}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(state.key!).then(() => setCopied(true));
              }}
              className={buttonClass("secondary", "sm")}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">Any lamp using an older key stops working until it&apos;s flashed with this one.</p>
        </div>
      ) : (
        <form action={action} className="mt-4">
          <motion.button type="submit" disabled={pending} whileTap={{ scale: 0.95 }} className={buttonClass(keyMadeAt ? "secondary" : "primary")}>
            {keyMadeAt ? "Make a new lamp key" : "Make a lamp key"}
          </motion.button>
        </form>
      )}
    </Card>
  );
}
