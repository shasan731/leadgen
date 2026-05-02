import { LeadDetail } from "@/components/leads/LeadDetail";
import { prisma } from "@/src/server/db/prisma";
import { requireAuth } from "@/src/server/auth/session";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      campaign: true,
      audits: { orderBy: { createdAt: "desc" } },
      extractedEmails: { orderBy: { createdAt: "desc" } },
      outreachDrafts: { orderBy: { updatedAt: "desc" } }
    }
  });

  if (!lead) {
    return <div className="text-sm text-muted-foreground">Lead not found.</div>;
  }

  return <LeadDetail lead={lead} />;
}
