import type { Metadata } from "next";
import { configuredProviders } from "@/lib/library/providers";
import { LibrarySearch } from "./LibrarySearch";

export const metadata: Metadata = {
  title: "Find a model",
  description: "Search free and paid 3D models from Thingiverse, MyMiniFactory, Cults3D, MakerWorld, Printables and more, then have it printed by Coastline Prints.",
};
export const dynamic = "force-dynamic";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Find a model to print</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Don&apos;t have an STL? Search the big 3D model sites. Download the file from the design&apos;s page, then upload it here to get your price.
      </p>
      <LibrarySearch initialQuery={q?.slice(0, 80) ?? ""} sources={configuredProviders().map((p) => p.name)} />
    </div>
  );
}
