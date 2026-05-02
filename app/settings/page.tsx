import { SettingsForm } from "@/components/layout/SettingsForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/src/server/db/prisma";
import { requireAuth } from "@/src/server/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAuth();
  const settings = await prisma.appSetting.findMany();
  const values = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Defaults used by templates, rate-limited jobs, and attribution display.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Application defaults</CardTitle>
          <CardDescription>Secrets remain in environment variables and are not exposed here.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm values={values} />
        </CardContent>
      </Card>
    </div>
  );
}
