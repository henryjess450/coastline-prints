import { lightlab } from "@config/lightlab";
import { SHARE_SIZE } from "@/lib/og/share-card";
import { lightlabShareCard } from "@/lib/shop/share-card";

export const runtime = "nodejs";
export const alt = `${lightlab.name}: novelty lamps from Victoria, BC`;
export const size = SHARE_SIZE;
export const contentType = "image/png";

/** The link preview for the LightLab shop. */
export default function Image() {
  return lightlabShareCard({ title: "Novelty lamps", line: "from Victoria, BC, at local markets and online" });
}
