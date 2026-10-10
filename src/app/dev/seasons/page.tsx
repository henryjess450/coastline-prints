import { notFound } from "next/navigation";
import { seasons } from "@config/seasons";
import { Benchy } from "@/components/brand/Benchy";
import { benchyLook, BenchyDecor } from "@/components/season/BenchyDecor";

export const metadata = { title: "Season preview", robots: { index: false } };

/** DEV ONLY: the Benchy dressed for every holiday, side by side. 404 in production. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4">
      {seasons.map((s) => (
        <figure key={s.id} className="rounded-2xl border border-line p-3 text-center">
          <svg viewBox="-90 -175 180 195" className="mx-auto h-40 w-40">
            <Benchy {...benchyLook(s.id)} />
            <BenchyDecor season={s.id} />
          </svg>
          <figcaption className="text-sm">{s.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}
