import { resetSettingAction } from "@/app/admin/actions";
import { MaterialsEditor } from "@/components/admin/MaterialsEditor";
import { PricingForm } from "@/components/admin/PricingForm";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/admin/auth";
import { getEffectiveConfig } from "@/lib/config/effective";
import { db } from "@/lib/db";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const cfg = await getEffectiveConfig();
  const overridden = new Set((await db.setting.findMany({ select: { key: true } })).map((s) => s.key));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      <Card className="p-5 sm:p-6">
        <SectionHead title="Pricing" note="Changes apply to new quotes immediately. Paid orders keep the price they were charged." resetKey={overridden.has("pricing") ? "pricing" : null} />
        <PricingForm pricing={cfg.pricing} />
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionHead title="Materials and colours" note="What customers can choose. Colours show in the 3D preview using the hex value and finish." resetKey={overridden.has("materials") ? "materials" : null} />
        <MaterialsEditor materials={cfg.materials} />
      </Card>

      <Card className="p-5 text-sm text-muted sm:p-6">
        <h2 className="mb-2 font-display text-lg font-semibold text-fg">Other settings</h2>
        <p>
          Pickup hours and closed days: <code className="font-mono">config/pickup.ts</code>. Printers: <code className="font-mono">config/printers.ts</code>. Passwords and keys: <code className="font-mono">.env</code>. After editing a
          file, rebuild with <code className="font-mono">docker compose up -d --build</code>.
        </p>
      </Card>
    </div>
  );
}

function SectionHead({ title, note, resetKey }: { title: string; note: string; resetKey: "pricing" | "materials" | null }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted">{note}</p>
      </div>
      {resetKey && (
        <form action={resetSettingAction}>
          <input type="hidden" name="key" value={resetKey} />
          <button className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline">Reset to defaults</button>
        </form>
      )}
    </div>
  );
}
