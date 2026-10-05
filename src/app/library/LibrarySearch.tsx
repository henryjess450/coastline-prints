"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PrintingLoader } from "@/components/motion/PrintingLoader";
import { cn } from "@/lib/cn";

type Result = {
  id: string;
  source: string;
  title: string;
  url: string;
  thumbnail: string | null;
  creator: string | null;
  license: string | null;
  priceCents: number | null;
  priceCurrency: string | null;
};
type Response = { results: Result[]; providers: { id: string; name: string; ok: boolean; count: number }[]; links: { name: string; url: string }[] };

type SearchState = { status: "idle" | "loading" | "done" | "error"; data?: Response; error?: string; query?: string };

/** Calls the search API and returns the next UI state (no React state inside). */
async function searchApi(t: string): Promise<SearchState> {
  try {
    const res = await fetch(`/api/library/search?q=${encodeURIComponent(t)}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Search failed.");
    return { status: "done", data: body, query: t };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : "Search failed.", query: t };
  }
}

const SOURCE_NAMES: Record<string, string> = { thingiverse: "Thingiverse", myminifactory: "MyMiniFactory", cults3d: "Cults3D" };

export function LibrarySearch({ initialQuery, sources }: { initialQuery: string; sources: string[] }) {
  const [q, setQ] = useState(initialQuery);
  const [state, setState] = useState<SearchState>(initialQuery ? { status: "loading", query: initialQuery } : { status: "idle" });

  function run(term: string) {
    const t = term.trim();
    if (t.length < 2) return;
    setState({ status: "loading", query: t });
    history.replaceState(null, "", `/library?q=${encodeURIComponent(t)}`);
    void searchApi(t).then(setState);
  }

  useEffect(() => {
    const t = initialQuery.trim();
    if (t.length < 2) return;
    let cancelled = false;
    void searchApi(t).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [initialQuery]);

  const data = state.data;
  return (
    <div className="mt-6 space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="flex max-w-2xl gap-2"
        role="search"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try: dragon, phone stand, cable clip…"
          aria-label="Search 3D models"
          maxLength={80}
          className="h-12 flex-1 rounded-full border border-line bg-surface px-5 text-base outline-none focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]"
        />
        <button type="submit" className="btn btn-primary h-12 px-6">
          Search
        </button>
      </form>
      <p className="text-xs text-faint">
        {sources.length ? `Results from ${sources.join(", ")}.` : "Search the biggest 3D model sites in one go."}
      </p>

      <AnimatePresence mode="wait">
        {state.status === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid place-items-center py-16">
            <PrintingLoader label={`Searching for “${state.query}”…`} />
          </motion.div>
        )}
        {state.status === "error" && (
          <motion.p key="error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-danger">
            {state.error}
          </motion.p>
        )}
        {state.status === "done" && data && (
          <motion.div key={state.query} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {data.results.length > 0 ? (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {data.results.map((r, i) => (
                  <motion.li key={`${r.source}-${r.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 16) * 0.03 }}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="group block h-full overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-accent-line">
                      <div className="aspect-[4/3] overflow-hidden bg-surface-strong">
                        {r.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        ) : (
                          <div className="grid h-full place-items-center text-xs text-faint">No preview</div>
                        )}
                      </div>
                      <div className="space-y-1 p-3">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug">{r.title}</p>
                        {r.creator && <p className="truncate text-xs text-muted">by {r.creator}</p>}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-text">{SOURCE_NAMES[r.source] ?? r.source}</span>
                          {r.priceCents === 0 && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">Free</span>}
                          {!!r.priceCents && (
                            <span className="rounded-full bg-sand/20 px-2 py-0.5 text-[11px] font-medium text-sand">
                              {r.priceCurrency === "USD" ? "US$" : "$"}
                              {(r.priceCents / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </a>
                  </motion.li>
                ))}
              </ul>
            ) : (
              data.providers.length > 0 && <p className="text-muted">No results from the connected sites. Try another word, or search the sites below.</p>
            )}

            <Card className="p-5">
              <h2 className="font-display text-lg font-semibold">Search more sites</h2>
              <p className="mt-1 text-sm text-muted">Opens each site&apos;s own search for “{state.query}” in a new tab.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.links.map((l) => (
                  <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" className={cn("btn btn-secondary h-10 px-4 text-sm")}>
                    {l.name} ↗
                  </a>
                ))}
              </div>
            </Card>

            <Card highlight className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-lg font-semibold">Found one?</h2>
                <p className="text-sm text-muted">Download the STL from the design&apos;s page, then upload it to see your price.</p>
              </div>
              <ButtonLink href="/order">Upload and get a price</ButtonLink>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
