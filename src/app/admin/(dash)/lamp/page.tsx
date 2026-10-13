import { LampPanel } from "@/components/admin/lamp/LampPanel";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import { getLampSettings, lampKeyMadeAt, lampPresence } from "@/lib/lamp/server";

export const metadata = { title: "Lamp" };

/** The order lamp: see if it's online, play its animations, choose what plays when something sells. */
export default async function LampPage() {
  await requireAdmin();
  const [settings, plays, keyMadeAt] = await Promise.all([getLampSettings(), db.lampEvent.findMany({ orderBy: { id: "desc" }, take: 8 }), lampKeyMadeAt()]);
  const p = lampPresence();
  return (
    <LampPanel
      settings={settings}
      status={{ online: p.online, agoMin: p.agoMin, rssi: p.rssi ?? null, version: p.version ?? null }}
      plays={plays.map((e) => ({ id: e.id, anim: e.anim, reason: e.reason, at: e.createdAt.toISOString() }))}
      keyMadeAt={keyMadeAt?.toISOString() ?? null}
      site={appUrl().replace(/^https?:\/\//, "")}
    />
  );
}
