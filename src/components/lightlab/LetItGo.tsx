"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** "Can't make it": cancels the hold so someone else can have the lamp. */
export function LetItGo({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!confirm("Let this lamp go so someone else can have it?")) return;
          setBusy(true);
          const r = await fetch(`/api/lightlab/stand/hold/${token}`, { method: "DELETE" }).catch(() => null);
          setBusy(false);
          if (r?.ok) router.refresh();
          else setError("Couldn't do that. It may have ended already.");
        }}
        className="text-sm text-muted underline underline-offset-4 hover:text-danger"
      >
        {busy ? "Letting it go…" : "Can't make it? Let it go"}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
