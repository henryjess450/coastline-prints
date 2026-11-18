"use client";
import { useState } from "react";
import { Field, fieldInput as input } from "@/components/admin/PrintFiles";
import { Button } from "@/components/ui/Button";

type Prize = { id: string; title: string; points: number; value: string; affordable: boolean };
export type RewardsProfile = { email: string; name: string; phone: string; hasAccount: boolean; points: number; prizes: Prize[] };
export type RegisterRedeemed = { code: string; label: string; email: string };

async function call<T>(method: string, body?: object, query = ""): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/admin/pos/rewards${query}`, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: data as T } : { ok: false, error: data.error ?? "That didn't work." };
  } catch {
    return { ok: false, error: "No internet." };
  }
}

/** The register's customer lookup: phone or email → their details and points, and spend points on this sale. */
export function RegisterRewards({ redeemed, onUse, onRedeem, onUndo }: { redeemed: RegisterRedeemed | null; onUse: (p: RewardsProfile) => void; onRedeem: (r: RegisterRedeemed) => void; onUndo: () => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<RewardsProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    if (q.trim().length < 3) return;
    setBusy(true);
    setError(null);
    const r = await call<RewardsProfile>("POST", { q });
    setBusy(false);
    if (!r.ok) return (setFound(null), setError(r.error));
    setFound(r.data);
    onUse(r.data);
  }

  async function redeem(p: Prize) {
    if (!found || busy) return;
    setBusy(true);
    setError(null);
    const r = await call<{ code: string; label: string; points: number }>("PUT", { email: found.email, prizeId: p.id });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setFound({ ...found, points: r.data.points, prizes: found.prizes.map((x) => ({ ...x, affordable: r.data.points >= x.points })) });
    onRedeem({ code: r.data.code, label: r.data.label, email: found.email });
  }

  function undo() {
    if (!redeemed) return;
    void call("DELETE", undefined, `?code=${encodeURIComponent(redeemed.code)}`);
    if (found) {
      const pts = found.points + (found.prizes.find((p) => p.title === redeemed.label)?.points ?? 0);
      setFound({ ...found, points: pts, prizes: found.prizes.map((x) => ({ ...x, affordable: pts >= x.points })) });
    }
    onUndo();
  }

  const canGet = found?.prizes.filter((p) => p.affordable) ?? [];
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <Field label="Find customer (phone or email)">
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="250 555 0101" autoComplete="off" />
        </Field>
        <Button type="submit" variant="secondary" disabled={busy || q.trim().length < 3}>
          {busy ? "…" : "Find"}
        </Button>
      </form>
      {found && (
        <div className="mt-3 text-sm">
          <p className="font-semibold">{found.name || found.email}</p>
          <p className="text-muted">
            {found.email}
            {found.phone ? ` · ${found.phone}` : ""}
            {found.hasAccount ? "" : " · no account"}
          </p>
          <p className="mt-1">
            <span className="font-mono font-bold">{found.points}</span> points
          </p>
          {redeemed ? (
            <p className="mt-2 flex items-center justify-between rounded-xl bg-success/15 px-3 py-2 text-success">
              <span>✓ {redeemed.label} added to this sale</span>
              <button type="button" onClick={undo} className="font-semibold underline">
                Undo
              </button>
            </p>
          ) : canGet.length ? (
            <div className="mt-2">
              <p className="text-muted">Ask if they want to use them:</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {canGet.map((p) => (
                  <Button key={p.id} variant="secondary" disabled={busy} onClick={() => redeem(p)}>
                    {p.title} · {p.points} pts
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-1 text-faint">Not enough for a prize yet ({found.prizes[0]?.points ?? 0} for the first).</p>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
