"use client";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useTransition } from "react";
import { deleteMarketAction, saveMarketAction, type MarketInput } from "@/app/lightlab/admin/markets/actions";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { dayParts, hours, type MarketDto } from "@/lib/shop/markets";

const input = "h-11 w-full rounded-xl border border-line bg-elev px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]";
const blank: MarketInput = { id: null, name: "", place: "", address: "", date: "", startTime: "09:00", endTime: "14:00", note: "", url: "" };

/** Add, edit and remove the markets shown under "Find us at" on the shop. */
export function MarketsEditor({ upcoming, past }: { upcoming: MarketDto[]; past: MarketDto[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<MarketInput | null>(null);
  const [flash, setFlash] = useState<{ text: string; bad?: boolean; n: number } | null>(null);
  const [pending, start] = useTransition();
  const say = (text: string, bad = false) => setFlash((f) => ({ text, bad, n: (f?.n ?? 0) + 1 }));

  function save() {
    if (!editing) return;
    start(async () => {
      const r = await saveMarketAction(editing);
      if (r.error) return say(r.error, true);
      say(r.message ?? "Saved.");
      setEditing(null);
      router.refresh();
    });
  }

  function remove(m: MarketDto) {
    if (!confirm(`Remove ${m.name} on ${dayParts(m.date).long}?`)) return;
    start(async () => {
      const r = await deleteMarketAction(m.id);
      say(r.error ?? r.message ?? "Removed.", !!r.error);
      if (editing?.id === m.id) setEditing(null);
      router.refresh();
    });
  }

  // "Same again": a new date for a market you've done before.
  const again = (m: MarketDto) => setEditing({ ...m, id: null, date: "" });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">These show under &ldquo;Find us at&rdquo; on the shop. Past dates hide themselves the day after.</p>
          <Button onClick={() => setEditing({ ...blank })}>+ Add a market</Button>
        </div>
        <AnimatePresence mode="wait">
          {flash && (
            <motion.p key={flash.n} role="status" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("-mt-4 text-sm", flash.bad ? "text-danger" : "text-success")}>
              {flash.text}
            </motion.p>
          )}
        </AnimatePresence>

        <section>
          <h2 className="font-display text-lg font-semibold">Coming up</h2>
          {upcoming.length ? (
            <ul className="mt-3 space-y-2">
              {upcoming.map((m) => (
                <MarketRow key={m.id} m={m} active={editing?.id === m.id} onEdit={() => setEditing({ ...m })} onRemove={() => remove(m)} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">No markets coming up. The &ldquo;Find us at&rdquo; section is hidden until you add one.</p>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold text-muted">Recent</h2>
            <ul className="mt-3 space-y-2 opacity-70">
              {past.map((m) => (
                <MarketRow key={m.id} m={m} onAgain={() => again(m)} onRemove={() => remove(m)} />
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <AnimatePresence mode="wait">
          {editing && (
            <motion.section key={editing.id ?? "new"} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold">{editing.id ? "Edit market" : "New market"}</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label="Market name" className="col-span-2">
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={input} placeholder="Saturday Makers Market" maxLength={80} autoFocus />
                </Field>
                <Field label="Where" className="col-span-2">
                  <input value={editing.place} onChange={(e) => setEditing({ ...editing, place: e.target.value })} className={input} placeholder="Community hall, main room" maxLength={120} />
                </Field>
                <Field label="Address (for the map link, optional)" className="col-span-2">
                  <input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} className={input} placeholder="123 Main St, Victoria" maxLength={200} />
                </Field>
                <Field label="Date" className="col-span-2">
                  <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className={input} />
                </Field>
                <Field label="Starts">
                  <input type="time" value={editing.startTime} onChange={(e) => setEditing({ ...editing, startTime: e.target.value })} className={input} />
                </Field>
                <Field label="Ends">
                  <input type="time" value={editing.endTime} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} className={input} />
                </Field>
                <Field label="Note (optional)" className="col-span-2">
                  <input value={editing.note ?? ""} onChange={(e) => setEditing({ ...editing, note: e.target.value })} className={input} placeholder="Find us by the main entrance" maxLength={200} />
                </Field>
                <Field label="Market's website (optional)" className="col-span-2">
                  <input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} className={input} placeholder="https://" maxLength={300} inputMode="url" />
                </Field>
              </div>
              <div className="mt-5 flex gap-2">
                <Button className="flex-1" onClick={save} disabled={pending}>
                  {pending ? "Saving…" : editing.id ? "Save" : "Add market"}
                </Button>
                <button type="button" onClick={() => setEditing(null)} className={buttonClass("secondary")}>
                  Cancel
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MarketRow({ m, active, onEdit, onAgain, onRemove }: { m: MarketDto; active?: boolean; onEdit?: () => void; onAgain?: () => void; onRemove: () => void }) {
  const d = dayParts(m.date);
  return (
    <li className={cn("flex flex-wrap items-center gap-4 rounded-2xl border bg-surface p-3", active ? "border-accent-line" : "border-line")}>
      <div className="grid w-14 shrink-0 place-items-center rounded-xl border border-line py-1.5 text-center leading-tight">
        <span className="text-[11px] uppercase text-muted">{d.month}</span>
        <span className="font-display text-xl font-bold">{d.day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{m.name}</p>
        <p className="truncate text-xs text-muted">
          {d.weekday} · {hours(m)} · {m.place}
        </p>
      </div>
      <div className="flex gap-2">
        {onEdit && (
          <button type="button" onClick={onEdit} className={buttonClass("secondary", "sm")}>
            Edit
          </button>
        )}
        {onAgain && (
          <button type="button" onClick={onAgain} className={buttonClass("secondary", "sm")} title="Add a new date for this market">
            Same again
          </button>
        )}
        <button type="button" onClick={onRemove} className="px-2 text-sm text-muted hover:text-danger" aria-label={`Remove ${m.name}`}>
          ✕
        </button>
      </div>
    </li>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
