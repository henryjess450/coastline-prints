import { notFound } from "next/navigation";
import { ReelScene } from "./ReelScene";

export const metadata = { title: "Reel", robots: { index: false } };

/**
 * DEV ONLY: full-screen plays of the holiday gift card animations, for
 * screen-recording Instagram reels (scripts in ~/.claude/instagram).
 * ?part=send (the delivery) or ?part=reveal (what they see), each ending on a card
 * pointing to the Christmas page. 404 in production.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ part?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <ReelScene part={(await searchParams).part === "reveal" ? "reveal" : "send"} />;
}
