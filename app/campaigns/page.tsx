import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/ui/delete-button";
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
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/campaigns/${campaign.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            Open
                          </Link>
                          <DeleteButton
                            endpoint={`/api/campaigns/${campaign.id}`}
                            redirectTo="/campaigns"
                            label="Delete"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to start finding business leads in any location."
          action={
            <Link href="/campaigns/new" className={buttonVariants()}>
              <Plus className="mr-2 h-4 w-4" />
              Create campaign
            </Link>
          }
        />
      )}
    </div>
  );
}
