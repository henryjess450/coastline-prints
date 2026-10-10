import { SHARE_SIZE, shareCard } from "@/lib/og/share-card";

export const runtime = "nodejs";
export const alt = "Coastline Prints gift cards";
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return shareCard({ title: "Give the gift of a 3D print" });
}
