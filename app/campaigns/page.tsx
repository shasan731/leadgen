import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/src/server/db/prisma";
import { requireAuth } from "@/src/server/auth/session";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  await requireAuth();
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true, jobs: true } } }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Create focused OSM searches and process them in small batches.</p>
        </div>
        <Link href="/campaigns/new" className={buttonVariants()}>
          <Plus className="h-4 w-4" aria-hidden />
          Create campaign
        </Link>
      </div>

      {campaigns.length ? (
        <Card>
          <CardHeader>
            <CardTitle>All campaigns</CardTitle>
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
                    <TableHead>Email</TableHead>
                    <TableHead>High score</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>{campaign.businessType}</TableCell>
                      <TableCell>{campaign.locationQuery}</TableCell>
                      <TableCell>
                        <Badge variant={campaign.status === "FAILED" ? "danger" : campaign.status === "COMPLETED" ? "success" : "secondary"}>
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{campaign.totalLeads}</TableCell>
                      <TableCell>{campaign.leadsWithEmail}</TableCell>
                      <TableCell>{campaign.highScoreLeads}</TableCell>
                      <TableCell>
                        <Link href={`/campaigns/${campaign.id}`} className="font-medium text-primary hover:underline">
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
      ) : (
        <EmptyState title="No campaigns yet" description="Create a campaign to geocode a location and collect nearby public business listings." />
      )}
    </div>
  );
}
