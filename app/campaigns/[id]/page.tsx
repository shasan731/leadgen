import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CampaignStatusCard } from "@/components/campaigns/CampaignStatusCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import { DeleteButton } from "@/components/ui/delete-button";
import { prisma } from "@/src/server/db/prisma";
import { requireAuth } from "@/src/server/auth/session";
import { defaultBatchSize, getEditableSettings } from "@/src/server/services/settings.service";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      jobs: { orderBy: { createdAt: "desc" }, take: 30 },
      leads: { orderBy: [{ leadScore: "desc" }, { createdAt: "desc" }], take: 12 }
    }
  });
  if (!campaign) {
    return <div className="text-sm text-muted-foreground">Campaign not found.</div>;
  }
  const settings = await getEditableSettings();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{campaign.name}</h1>
            <Badge variant={campaign.status === "FAILED" ? "danger" : campaign.status === "COMPLETED" ? "success" : "secondary"}>{campaign.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {campaign.businessType} in {campaign.locationQuery} within {campaign.radiusMeters.toLocaleString()}m.
          </p>
        </div>
        <Link href={`/leads?campaignId=${campaign.id}`} className="text-sm font-medium text-primary hover:underline">
          View all leads
        </Link>
        <DeleteButton endpoint={`/api/campaigns/${campaign.id}`} redirectTo="/campaigns" label="Delete campaign" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total leads" value={campaign.totalLeads} />
        <SummaryCard label="Enriched" value={campaign.enrichedLeads} />
        <SummaryCard label="With email" value={campaign.leadsWithEmail} />
        <SummaryCard label="High score" value={campaign.highScoreLeads} />
      </div>

      <CampaignStatusCard campaignId={campaign.id} defaultBatchSize={defaultBatchSize(settings)} />

      <Card>
        <CardHeader>
          <CardTitle>Job status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last error</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.type}</TableCell>
                    <TableCell>
                      <Badge variant={job.status === "FAILED" ? "danger" : job.status === "COMPLETED" ? "success" : "secondary"}>{job.status}</Badge>
                    </TableCell>
                    <TableCell>{job.attempts}</TableCell>
                    <TableCell className="max-w-xs truncate">{job.lastError ?? ""}</TableCell>
                    <TableCell>{formatDistanceToNow(job.createdAt, { addSuffix: true })}</TableCell>
                    <TableCell>{formatDistanceToNow(job.updatedAt, { addSuffix: true })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leads preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Score</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <LeadScoreBadge score={lead.leadScore} />
                    </TableCell>
                    <TableCell className="font-medium">{lead.companyName ?? "Unnamed business"}</TableCell>
                    <TableCell>{lead.phone ?? ""}</TableCell>
                    <TableCell>{lead.email ?? ""}</TableCell>
                    <TableCell className="max-w-xs truncate">{lead.website ?? ""}</TableCell>
                    <TableCell>
                      <Link href={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}
