import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { adminConfigured, isAdmin } from "@/lib/admin/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="mx-auto max-w-sm px-4 pt-16">
      <Card className="p-6">
        <h1 className="font-display text-2xl font-bold">Admin login</h1>
        {adminConfigured() ? (
          <LoginForm />
        ) : (
          <p className="mt-3 text-sm text-muted">
            Admin login isn&apos;t set up. Add <code className="font-mono">ADMIN_USERNAME</code> and <code className="font-mono">ADMIN_PASSWORD</code> to <code className="font-mono">.env</code> and restart the site.
          </p>
        )}
      </Card>
    </div>
  );
}
