import Link from "next/link";
import { JobStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/src/server/db/prisma";
import { requireAuth } from "@/src/server/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireAuth();
  const [totalCampaigns, totalLeads, leadsWithEmail, highScoreLeads, pendingJobs, failedJobs, recentCampaigns] =
    await Promise.all([
      prisma.campaign.count(),
      prisma.lead.count(),
      prisma.lead.count({ where: { email: { not: null } } }),
      prisma.lead.count({ where: { leadScore: { gte: 80 } } }),
      prisma.job.count({ where: { status: JobStatus.PENDING } }),
      prisma.job.count({ where: { status: JobStatus.FAILED } }),
      prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, take: 5 })
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Small-batch public lead collection and enrichment.</p>
        </div>
        <Link href="/campaigns/new" className={buttonVariants()}>
          <Plus className="h-4 w-4" aria-hidden />
          Create campaign
        </Link>
      </div>

      <StatsCards stats={{ totalCampaigns, totalLeads, leadsWithEmail, highScoreLeads, pendingJobs, failedJobs }} />

      <Card>
        <CardHeader>
          <CardTitle>Recent campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leads</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCampaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <Link href={`/campaigns/${campaign.id}`} className="font-medium hover:underline">
                        {campaign.name}
                      </Link>
                    </TableCell>
                    <TableCell>{campaign.businessType}</TableCell>
                    <TableCell>{campaign.locationQuery}</TableCell>
                    <TableCell>{campaign.status}</TableCell>
                    <TableCell>{campaign.totalLeads}</TableCell>
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
