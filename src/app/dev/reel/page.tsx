import { notFound } from "next/navigation";
import { ReelScene } from "./ReelScene";

export const metadata = { title: "Reel", robots: { index: false } };

/**
 * DEV ONLY: full-screen plays of the holiday gift card animations, for
 * screen-recording Instagram reels (scripts in ~/.claude/instagram).
 * ?part=send (the delivery), ?part=reveal (what they see) or ?part=thanksgiving, each ending on a card
 * (&scale=2 to record at 1080x1920 from a phone-sized layout)
 * pointing to the Christmas page. 404 in production.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ part?: string; scale?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  const part = q.part === "reveal" || q.part === "thanksgiving" ? q.part : "send";
  return <ReelScene part={part} scale={Math.min(4, Math.max(1, Number(q.scale) || 1))} />;
}
