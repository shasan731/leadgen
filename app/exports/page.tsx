import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { prisma } from "@/src/server/db/prisma";
import { requireAuth } from "@/src/server/auth/session";

export const dynamic = "force-dynamic";

const columns = [
  "campaign_name",
  "company_name",
  "category",
  "address",
  "phone",
  "website",
  "email",
  "email_status",
  "lead_score",
  "lead_quality",
  "opportunity_summary",
  "outreach_subject",
  "outreach_body",
  "facebook_url",
  "instagram_url",
  "linkedin_url",
  "contact_page_url",
  "website_issues",
  "created_at"
];

export default async function ExportsPage() {
  await requireAuth();
  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Exports</h1>
        <p className="text-sm text-muted-foreground">Download reviewed lead data as CSV. Raw JSON is not exported by default.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV download</CardTitle>
          <CardDescription>Apply lightweight filters before exporting.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/exports/csv" method="get" className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Campaign</Label>
              <Select name="campaignId">
                <option value="">All campaigns</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Minimum score</Label>
              <Input type="number" name="minScore" min={0} max={100} />
            </div>
            <div className="space-y-2">
              <Label>Has email</Label>
              <Select name="hasEmail">
                <option value="">Any</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Outreach status</Label>
              <Select name="status">
                <option value="">Any</option>
                {["NOT_STARTED", "DRAFT_CREATED", "APPROVED", "EXPORTED", "CONTACTED", "REPLIED", "NOT_INTERESTED"].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-4">
              <Button type="submit">
                <Download className="h-4 w-4" aria-hidden />
                Download CSV
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export columns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {columns.map((column) => (
              <code key={column} className="rounded-md bg-muted px-2 py-1 text-xs">
                {column}
              </code>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
