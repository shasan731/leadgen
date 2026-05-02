import { CampaignForm } from "@/components/campaigns/CampaignForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/src/server/auth/session";
import { defaultRadius, getEditableSettings } from "@/src/server/services/settings.service";

export default async function NewCampaignPage() {
  await requireAuth();
  const settings = await getEditableSettings();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New campaign</h1>
        <p className="text-sm text-muted-foreground">Set a local category, location, and service offer for deterministic lead scoring.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Campaign details</CardTitle>
          <CardDescription>Location is geocoded once and cached. Lead collection uses Overpass in one small query.</CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignForm
            defaults={{
              radiusMeters: defaultRadius(settings),
              senderName: settings.senderName,
              senderCompany: settings.senderCompany,
              senderService: settings.senderService
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
