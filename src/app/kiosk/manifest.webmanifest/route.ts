import { tabletManifest } from "@/lib/tablet-manifest";

export const dynamic = "force-static";

export function GET() {
  return tabletManifest("/kiosk", "LightLab self-checkout", "Kiosk");
}
