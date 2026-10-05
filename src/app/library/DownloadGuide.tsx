"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { uploads } from "@config/site";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const general = [
  { title: "Find a design", body: "Search above, or browse one of the sites directly." },
  { title: "Download the STL", body: "Most sites need a free account before you can download. See your site's steps below." },
  { title: "Unzip if needed", body: "If you get a .zip file, unzip it first. Windows: right-click it and choose Extract All. Mac: double-click it." },
  { title: "Upload it here", body: `Go to Start an order and drop in the .stl files (up to ${uploads.maxFileMb} MB each). You'll see the price right away.` },
];

const sites: { name: string; steps: string[]; tip?: string }[] = [
  {
    name: "Thingiverse",
    steps: ["Open the design's page.", "Click Download All Files to get a .zip of everything.", "Unzip it. The .stl files are usually in a folder called files."],
    tip: "Prefer one part? Open the Files tab on the design's page and download just that STL.",
  },
  {
    name: "Printables",
    steps: ["Open the model's page and click Download.", "Pick the .stl file you want from the list, or download all files as a .zip.", "Sign in with a free Prusa account if it asks."],
  },
  {
    name: "MakerWorld",
    steps: ["Sign in with a free Bambu Lab account.", "Open the model and click the arrow next to the download button.", "Choose the option to download the STL/CAD files, not Open in Bambu Studio."],
    tip: "Only got a .3mf file? Open it in Bambu Studio (free), then choose File, Export, Export all objects as STL, and upload that.",
  },
  {
    name: "Thangs",
    steps: ["Open the model and click Download.", "Choose STL as the file format.", "Sign in with a free account if it asks."],
  },
  {
    name: "MyMiniFactory",
    steps: ["Sign in with a free account.", "Open the object and click Download. Paid designs need to be bought first.", "Unzip the download to get the .stl files."],
  },
  {
    name: "Cults3D",
    steps: ["Sign in with a free account.", "Free models: click Download. Paid models: buy it, then download it from your Cults3D library.", "Unzip the download to get the .stl files."],
  },
];

export function DownloadGuide() {
  const [open, setOpen] = useState(sites[0].name);
  const site = sites.find((s) => s.name === open)!;
  return (
    <section aria-labelledby="guide-title" className="mt-14 space-y-6">
      <div>
        <h2 id="guide-title" className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          How to download an STL
        </h2>
        <p className="mt-1 text-muted">Four quick steps, then tips for each site.</p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {general.map((g, i) => (
          <li key={g.title}>
            <Card className="h-full p-4">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">{i + 1}</span>
              <h3 className="mt-3 font-semibold">{g.title}</h3>
              <p className="mt-1 text-sm text-muted">{g.body}</p>
            </Card>
          </li>
        ))}
      </ol>

      <Card className="p-5 sm:p-6">
        <div role="tablist" aria-label="Download steps by site" className="flex flex-wrap gap-2">
          {sites.map((s) => (
            <button
              key={s.name}
              type="button"
              role="tab"
              aria-selected={open === s.name}
              onClick={() => setOpen(s.name)}
              className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", open === s.name ? "border-accent-line bg-accent text-accent-ink" : "border-line text-muted hover:text-fg")}
            >
              {s.name}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={site.name} role="tabpanel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="mt-5">
            <h3 className="font-display text-lg font-semibold">Downloading from {site.name}</h3>
            <ol className="mt-3 space-y-2">
              {site.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-text">{i + 1}</span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            {site.tip && <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm">{site.tip}</p>}
          </motion.div>
        </AnimatePresence>
      </Card>

      <p className="text-sm text-muted">
        Sites change their buttons now and then. If something looks different, look for a Download button on the design&apos;s page. Need help? Email us the link and we&apos;ll take a look.
      </p>
    </section>
  );
}
