import { dayParts, hours, mapsUrl, type MarketDto } from "@/lib/shop/markets";

/** "Find us at": the markets LightLab is at next. Hidden when there are none. */
export function FindUsAt({ markets }: { markets: MarketDto[] }) {
  if (!markets.length) return null;
  return (
    <section id="markets" className="mx-auto mt-28 max-w-7xl scroll-mt-24 px-4 sm:px-6">
      <p className="ll-accent text-3xl">come say hi</p>
      <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Find us at</h2>
      <p className="mt-3 max-w-xl text-muted">See the lamps in person. These are the markets we&apos;re at next.</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {markets.map((m) => {
          const d = dayParts(m.date);
          return (
            <li key={m.id} className="flex gap-4 rounded-3xl border border-line bg-surface p-5">
              <div className="grid h-20 w-16 shrink-0 place-items-center rounded-2xl bg-accent py-2 text-center leading-none text-accent-ink" aria-hidden>
                <span className="text-xs font-semibold uppercase tracking-wider">{d.month}</span>
                <span className="font-display text-3xl font-extrabold">{d.day}</span>
                <span className="text-xs">{d.weekday}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold leading-snug">
                  {m.url ? (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {m.name}
                    </a>
                  ) : (
                    m.name
                  )}
                </h3>
                <p className="sr-only">{d.long}</p>
                <p className="mt-0.5 text-sm">{hours(m)}</p>
                <p className="mt-0.5 text-sm text-muted">{m.place}</p>
                {m.note && <p className="ll-accent mt-1 text-lg">{m.note}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {m.address && (
                    <a href={mapsUrl(m.address)} target="_blank" rel="noopener noreferrer" className="text-accent-text underline underline-offset-4">
                      Map
                    </a>
                  )}
                  <a href={`/lightlab/markets/${m.id}/calendar`} className="text-accent-text underline underline-offset-4">
                    Add to calendar
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
