import { notFound } from "next/navigation";
import { LampPanel } from "@/components/admin/lamp/LampPanel";
import { lampSettingsSchema } from "@/lib/lamp/server";

export const metadata = { title: "Lamp preview", robots: { index: false } };

/** DEV ONLY: the admin Lamp page with sample status, for checking the ring previews (?colours=1: mid "Set the bottom"). 404 in production. */
export default async function Page({ searchParams }: { searchParams: Promise<{ colours?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <LampPanel
        settings={lampSettingsSchema.parse({ idle: "calm" })}
        quietNow={false}
        identifying={(await searchParams).colours === "1"}
        status={{ online: true, agoMin: 0, rssi: -58, version: "1" }}
        plays={[
          { id: 4, anim: "payment", value: 64, reason: "print", at: "2026-10-12T19:04:00Z" },
          { id: 3, anim: "treasure", value: 64, reason: "print", at: "2026-10-12T19:04:00Z" },
          { id: 2, anim: "tide", reason: "print", at: "2026-10-12T19:04:00Z" },
          { id: 1, anim: "sunset", reason: "gift", at: "2026-10-11T22:41:00Z" },
        ]}
        keyMadeAt="2026-10-12T18:00:00Z"
        site="coastlineprints.ca"
      />
    </div>
  );
}
