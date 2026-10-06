import type { Metadata } from "next";
import { GiftCardShop } from "@/components/gifts/GiftCardShop";
import { scheduleRange } from "@/lib/giftcards/rules";
import { squarePublicConfig } from "@/lib/square/client";

export const metadata: Metadata = {
  title: "Gift cards",
  description: "Send a Coastline Prints gift card by email, today or on a day you choose. Works on any 3D print order and doesn't expire.",
};
export const dynamic = "force-dynamic"; // the schedule range depends on today's date

export default async function GiftCardsPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  // ?demo=1 previews the animation without charging a card. Development only.
  const demo = process.env.NODE_ENV !== "production" && (await searchParams).demo === "1";
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
      <div className="mb-12 max-w-2xl">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Give the gift of 3D printing</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">Send a gift card by email, today or on a day you choose.</p>
      </div>
      <GiftCardShop square={squarePublicConfig()} range={scheduleRange()} demo={demo} />
    </div>
  );
}
