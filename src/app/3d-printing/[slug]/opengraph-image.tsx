import { SHARE_SIZE, shareCard } from "@/lib/og/share-card";
import { findUse, uses } from "@/lib/uses";

export const runtime = "nodejs";
export const alt = "Coastline Prints";
export const size = SHARE_SIZE;
export const contentType = "image/png";
export const generateStaticParams = () => uses.map((u) => ({ slug: u.slug }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const u = findUse((await params).slug);
  return shareCard({ title: u?.h1 ?? "Custom 3D prints, priced in seconds" });
}
