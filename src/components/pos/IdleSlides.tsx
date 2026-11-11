"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { OneLineLamps } from "@/components/lightlab/hero/OneLineLamps";
import type { DisplaySlides } from "@/lib/pos/types";
import { Qr } from "./bits";

type Slide = { key: string; render: () => React.ReactNode };

/**
 * The LightLab customer display between sales: a slideshow that moves on by
 * itself, sized to fill a tablet. Which slides run, their order, the lamps
 * that get a slide and the speed are set on Admin > Display. `slides` is
 * passed in for previews; the real display loads them and refreshes every
 * few minutes, so changes reach the stand without touching it.
 */
export function IdleSlides({ slides: given, quick = false }: { slides?: DisplaySlides; /** Admin preview: 3 seconds a slide, tap or → for the next. */ quick?: boolean }) {
  const [loaded, setLoaded] = useState<DisplaySlides | null>(null);
  const data = given ?? loaded;
  useEffect(() => {
    if (given) return;
    const load = () =>
      fetch("/api/pos/display/slides", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: DisplaySlides | null) => d && setLoaded(d), () => undefined);
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [given]);

  const order = useMemo<Slide[]>(() => {
    if (!data) return [{ key: "welcome", render: () => <Welcome /> }];
    const out: Slide[] = [];
    for (const kind of data.slides) {
      if (kind === "welcome") out.push({ key: kind, render: () => <Welcome /> });
      if (kind === "lamps") data.products.forEach((p, i) => out.push({ key: `lamp-${i}`, render: () => <Lamp p={p} /> }));
      if (kind === "markets" && data.markets.length) out.push({ key: kind, render: () => <Markets markets={data.markets} /> });
      if (kind === "shop") out.push({ key: kind, render: () => <Scan url={data.links.shop} kicker="Shop online" heading="Can't carry it home?" accent="We'll ship it." text="Every lamp ships anywhere in Canada. Scan to order from home, any time." /> });
      if (kind === "orders") out.push({ key: kind, render: () => <Statement kicker="We take orders" heading="Don't see the one you want?" accent="Order it right here." text="Sold out, or after a few for gifts? Order at the stand and it's ready in about a week, for pickup in Victoria or shipped to you." /> });
      if (kind === "gifts") out.push({ key: kind, render: () => <Statement kicker="Gift cards" heading="Give the gift of light" accent={data.giftBonus ?? "Any amount, sent by email."} text="Gift cards work on every LightLab lamp and Coastline print. Ask us at the stand, or get one at coastlineprints.ca/gift-cards." /> });
      if (kind === "made") out.push({ key: kind, render: () => <Made /> });
      if (kind === "comeback" && data.comebackPercent) out.push({ key: kind, render: () => <Statement kicker="Keep your receipt" heading={`${data.comebackPercent}% off`} accent="your next visit to the stand." text="Every receipt has a coupon on the bottom. Bring it to any LightLab market." huge /> });
      if (kind === "coastline") out.push({ key: kind, render: () => <Partner line={data.partnerLine} /> });
      if (kind === "follow") out.push({ key: kind, render: () => <Scan url={data.links.instagram} kicker="Instagram" heading="Follow along" accent="New lamps, first." text="Behind the scenes, new colours, market dates and giveaways." /> });
      const review = data.links.review;
      if (kind === "review" && review) out.push({ key: kind, render: () => <Scan url={review}kicker="Reviews" heading="Loving your lamp?" accent="Tell people about it." text="A quick Google review really helps a small local maker." /> });
    }
    return out.length ? out : [{ key: "welcome", render: () => <Welcome /> }];
  }, [data]);

  // The admin preview runs quicker, and a tap or → skips ahead, to get through them fast.
  const seconds = quick ? 3 : (data?.seconds ?? 8);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => s + 1), seconds * 1000);
    return () => clearInterval(id);
  }, [seconds, step]);
  useEffect(() => {
    if (!quick) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") setStep((s) => s + 1);
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [quick]);
  const at = step % order.length;
  const slide = order[at];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" onClick={quick ? () => setStep((s) => s + 1) : undefined}>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${slide.key}-${step}`}
          initial={{ opacity: 0, y: 30, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-h-0 flex-1 items-center"
        >
          {slide.render()}
        </motion.div>
      </AnimatePresence>
      {order.length > 1 && (
        <div className="mx-auto mt-4 flex w-full max-w-xl gap-2" aria-hidden>
          {order.map((s, i) => (
            <span key={s.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/15">
              {i === at && <motion.span key={step} className="block h-full rounded-full bg-[#297f9d]" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: seconds, ease: "linear" }} />}
              {i < at && <span className="block h-full rounded-full bg-fg/45" />}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const kickerCls = "text-[1.6vw] font-semibold uppercase tracking-[0.3em] text-muted";
const headingCls = "font-display text-[6.4vw] font-bold leading-[0.98] tracking-tight";
const accentCls = "ll-accent text-[4vw] leading-tight";
const textCls = "text-[2vw] leading-snug text-fg/75";

function Welcome() {
  return (
    <div className="mx-auto grid w-full max-w-[92vw] grid-cols-[0.9fr_1.1fr] items-center gap-[4vw]">
      <div className="h-[62vh]">
        <OneLineLamps />
      </div>
      <div>
        <p className="font-display text-[9vw] font-bold leading-none tracking-tight">Hi there!</p>
        <p className="ll-accent mt-[2vh] text-[5vw] leading-tight">Ready to check out?</p>
        <p className="mt-[3vh] text-[2.2vw] text-fg/70">Bring your lamp to the counter and we&apos;ll ring it up.</p>
      </div>
    </div>
  );
}

function Lamp({ p }: { p: DisplaySlides["products"][number] }) {
  return (
    <div className="mx-auto grid w-full max-w-[94vw] grid-cols-2 items-center gap-[4vw]">
      <div className="h-[70vh] overflow-hidden rounded-[3vw] bg-surface">
        {p.image && (
          <motion.img src={p.image} alt="" className="h-full w-full object-cover" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 9, ease: "easeOut" }} />
        )}
      </div>
      <div>
        <p className={kickerCls}>Handmade in Victoria</p>
        <p className={`${headingCls} mt-[2vh]`}>{p.name}</p>
        {p.tagline && <p className={`${accentCls} mt-[2vh]`}>{p.tagline}</p>}
        <p className="mt-[4vh] inline-block rounded-full bg-fg px-[2.4vw] py-[1vh] font-display text-[4.4vw] font-bold text-bg">{p.price}</p>
      </div>
    </div>
  );
}

function Scan({ url, kicker, heading, accent, text }: { url: string; kicker: string; heading: string; accent: string; text: string }) {
  return (
    <div className="mx-auto grid w-full max-w-[92vw] grid-cols-[auto_1fr] items-center gap-[5vw]">
      <div className="flex flex-col items-center">
        <Qr value={url} className="h-[32vh] w-[32vh] p-[1.2vh] shadow-2xl" />
        <p className="mt-[2vh] text-[1.6vw] font-semibold text-fg/70">Point your phone&apos;s camera here</p>
      </div>
      <div>
        <p className={kickerCls}>{kicker}</p>
        <p className={`${headingCls} mt-[2vh]`}>{heading}</p>
        <p className={`${accentCls} mt-[1.5vh]`}>{accent}</p>
        <p className={`${textCls} mt-[3vh] max-w-[40vw]`}>{text}</p>
      </div>
    </div>
  );
}

function Statement({ kicker, heading, accent, text, huge }: { kicker: string; heading: string; accent: string; text: string; huge?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[84vw] text-center">
      <p className={kickerCls}>{kicker}</p>
      <p className={huge ? "mt-[2vh] font-display text-[15vw] font-bold leading-none tracking-tight" : `${headingCls} mt-[2vh] text-[8vw]`}>{heading}</p>
      <p className={`${accentCls} mt-[2vh] text-[4.6vw]`}>{accent}</p>
      <p className={`${textCls} mx-auto mt-[4vh] max-w-[60vw]`}>{text}</p>
    </div>
  );
}

function Made() {
  return (
    <div className="mx-auto grid w-full max-w-[92vw] grid-cols-[1.15fr_0.85fr] items-center gap-[4vw]">
      <div>
        <p className={kickerCls}>Welcome to LightLab</p>
        <p className={`${headingCls} mt-[2vh] text-[7vw]`}>A novelty lamp shop in Victoria, BC.</p>
        <p className={`${accentCls} mt-[2vh]`}>Made right here on the island.</p>
        <p className={`${textCls} mt-[3vh] max-w-[46vw]`}>We sell at local markets like this one, and online at coastlineprints.ca/lightlab.</p>
      </div>
      <div className="h-[60vh]">
        <OneLineLamps />
      </div>
    </div>
  );
}

/** Coastline Prints, LightLab's printing partner (the line from the shop's site). */
function Partner({ line }: { line: string }) {
  const [shop, rest] = line.split(" is the ");
  return (
    <div className="mx-auto w-full max-w-[86vw] text-center">
      <p className={kickerCls}>Printed by</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/wordmark-white.png" alt="" width={374} height={220} className="mx-auto mt-[3vh] h-[18vh] w-auto" />
      <p className="mt-[2vh] font-display text-[7vw] font-bold leading-none tracking-tight">{shop}</p>
      {rest && <p className={`${accentCls} mt-[2.5vh] text-[4vw]`}>the {rest}</p>}
      <p className={`${textCls} mx-auto mt-[4vh] max-w-[62vw]`}>Got an idea of your own? Coastline 3D prints almost anything, from gifts to parts. Start an order at coastlineprints.ca.</p>
    </div>
  );
}

function Markets({ markets }: { markets: DisplaySlides["markets"] }) {
  const shown = markets.slice(0, 3);
  // Just one coming up: make it the whole slide.
  if (shown.length === 1) {
    const m = shown[0];
    return (
      <div className="mx-auto grid w-full max-w-[92vw] grid-cols-[auto_1fr] items-center gap-[5vw]">
        <motion.div initial={{ rotate: -4, scale: 0.9 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 160, damping: 14 }} className="flex w-[24vw] flex-col items-center rounded-[3vw] bg-fg py-[3vh] text-bg">
          <span className="text-[3vw] font-semibold uppercase tracking-widest">{m.month}</span>
          <span className="font-display text-[14vw] font-bold leading-[0.9]">{m.day}</span>
          <span className="text-[2.6vw] font-semibold uppercase">{m.weekday}</span>
        </motion.div>
        <div>
          <p className={kickerCls}>Find us next</p>
          <p className={`${headingCls} mt-[1.5vh]`}>{m.name}</p>
          <p className="mt-[3vh] text-[3vw] font-semibold">{m.hours}</p>
          <p className="text-[2.4vw] text-fg/80">{m.place}</p>
          {m.address && <p className="text-[2vw] text-fg/55">{m.address}</p>}
          <p className="ll-accent mt-[2.5vh] text-[3vw] leading-snug">{m.note || "Come say hi at the LightLab stand!"}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-[94vw]">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className={kickerCls}>Come say hi again</p>
          <p className={`${headingCls} mt-[1vh]`}>Find us next</p>
        </div>
        <p className="ll-accent pb-[1vh] text-[3vw]">at the LightLab stand</p>
      </div>
      <ul className={`mt-[4vh] grid gap-[1.6vw] ${shown.length === 1 ? "grid-cols-1" : shown.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {shown.map((m, i) => (
          <motion.li
            key={m.name + m.long}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`flex flex-col rounded-[2.2vw] bg-surface p-[2vw] ${i === 0 ? "ring-2 ring-[#297f9d]" : ""}`}
          >
            <div className="flex items-center gap-[1.4vw]">
              <div className="flex w-[8vw] shrink-0 flex-col items-center rounded-[1.4vw] bg-fg py-[1vh] text-bg">
                <span className="text-[1.5vw] font-semibold uppercase tracking-widest">{m.month}</span>
                <span className="font-display text-[4.6vw] font-bold leading-none">{m.day}</span>
                <span className="text-[1.3vw] font-semibold uppercase">{m.weekday}</span>
              </div>
              <div className="min-w-0">
                {i === 0 && <p className="text-[1.3vw] font-bold uppercase tracking-[0.2em] text-[#297f9d]">Next up</p>}
                <p className="font-display text-[2.6vw] font-bold leading-tight">{m.name}</p>
              </div>
            </div>
            <p className="mt-[2vh] text-[1.9vw] font-semibold">{m.hours}</p>
            <p className="text-[1.7vw] text-fg/75">{m.place}</p>
            {m.address && <p className="text-[1.5vw] text-fg/55">{m.address}</p>}
            {m.note && <p className="ll-accent mt-[1.5vh] text-[2vw] leading-snug">{m.note}</p>}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
