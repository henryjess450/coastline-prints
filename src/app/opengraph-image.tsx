import { SHARE_SIZE, shareCard } from "@/lib/og/share-card";

export const runtime = "nodejs";
export const alt = "Coastline Prints: custom 3D prints, priced in seconds";
export const size = SHARE_SIZE;
export const contentType = "image/png";

/** The picture for any shared link that doesn't have its own. */
export default function Image() {
  return shareCard({ title: "Custom 3D prints, priced in seconds" });
}
