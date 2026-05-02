import Link from "next/link";
import type { Lead } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SafeLink } from "@/components/ui/safe-link";
import { CopyButton } from "@/components/ui/copy-button";
import { LeadScoreBadge } from "./LeadScoreBadge";

type LeadWithCampaign = Lead & {
  campaign?: {
    name: string;
  };
};

export function LeadsTable({ leads }: { leads: LeadWithCampaign[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Score</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Website</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Email status</TableHead>
            <TableHead>Issues</TableHead>
            <TableHead>Outreach</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>
                <LeadScoreBadge score={lead.leadScore} />
              </TableCell>
              <TableCell className="sticky left-0 min-w-48 bg-white font-medium">{lead.companyName ?? "Unnamed business"}</TableCell>
              <TableCell>{lead.category ?? ""}</TableCell>
              <TableCell className="max-w-xs truncate">{lead.address ?? ""}</TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center gap-1">{lead.phone ?? ""}<CopyButton value={lead.phone} label="Copy phone" /></div>
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {lead.website ? (
                  <SafeLink href={lead.website} external className="text-primary hover:underline">
                    {lead.normalizedDomain ?? lead.website}
                  </SafeLink>
                ) : (
                  ""
                )}
              </TableCell>
              <TableCell><div className="flex items-center gap-1">{lead.email ?? ""}<CopyButton value={lead.email} label="Copy email" /></div></TableCell>
              <TableCell>
                <Badge variant={lead.emailStatus === "MX_FOUND" ? "success" : lead.emailStatus === "INVALID_FORMAT" ? "danger" : "secondary"}>
                  {lead.emailStatus}
                </Badge>
              </TableCell>
              <TableCell>{Array.isArray(lead.issuesJson) ? lead.issuesJson.length : 0}</TableCell>
              <TableCell>{lead.outreachStatus}</TableCell>
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
  );
}
