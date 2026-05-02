import type { Campaign, ExtractedEmail, Lead, OutreachDraft, WebsiteAudit } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SafeLink } from "@/components/ui/safe-link";
import { CopyButton } from "@/components/ui/copy-button";
import { DeleteButton } from "@/components/ui/delete-button";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { WebsiteIssuesList } from "./WebsiteIssuesList";
import { OutreachDraftCard } from "./OutreachDraftCard";
import { LeadNotesCard } from "./LeadNotesCard";

type LeadDetailData = Lead & {
  campaign: Campaign;
  audits: WebsiteAudit[];
  extractedEmails: ExtractedEmail[];
  outreachDrafts: OutreachDraft[];
};

export function LeadDetail({ lead }: { lead: LeadDetailData }) {
  const audit = lead.audits[0];
  const draft = lead.outreachDrafts[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{lead.companyName ?? "Unnamed business"}</h1>
          <p className="text-sm text-muted-foreground">
            {lead.category ?? lead.campaign.businessType} from{" "}
            <SafeLink href={`/campaigns/${lead.campaignId}`} className="font-medium text-primary hover:underline">
              {lead.campaign.name}
            </SafeLink>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{lead.outreachStatus}</Badge>
          <LeadScoreBadge score={lead.leadScore} />
          <DeleteButton endpoint={`/api/leads/${lead.id}`} redirectTo={`/campaigns/${lead.campaignId}`} label="Delete lead" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Info label="Company" value={lead.companyName} />
            <Info label="Category" value={lead.category} />
            <Info label="Address" value={lead.address} />
            <Info label="Coordinates" value={lead.latitude && lead.longitude ? `${lead.latitude}, ${lead.longitude}` : null} />
            <Info label="Source" value={lead.sourceId} linkHref={osmSourceUrl(lead.sourceType, lead.sourceId)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Info label="Phone" value={lead.phone} copy />
            <Info label="Email" value={lead.email} copy />
            <Info label="Email status" value={lead.emailStatus} />
            <Info label="Website" value={lead.website} linkHref={lead.website} />
            <Info label="Contact page" value={lead.contactPageUrl} linkHref={lead.contactPageUrl} />
            <Info label="Facebook" value={lead.facebookUrl} linkHref={lead.facebookUrl} />
            <Info label="Instagram" value={lead.instagramUrl} linkHref={lead.instagramUrl} />
            <Info label="LinkedIn" value={lead.linkedinUrl} linkHref={lead.linkedinUrl} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Website audit</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {audit ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Info label="HTTP status" value={audit.httpStatus ? String(audit.httpStatus) : null} />
              <Info label="Pages crawled" value={String(audit.pagesCrawled)} />
              <Info label="Load time" value={audit.loadTimeMs ? `${audit.loadTimeMs}ms` : null} />
              <Info label="Title" value={audit.title} />
              <Info label="Meta description" value={audit.metaDescription} />
              <Info label="H1" value={audit.h1} />
            </div>
          ) : (
            <p className="text-muted-foreground">No audit has been recorded yet.</p>
          )}
          <WebsiteIssuesList issuesJson={lead.issuesJson} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Extracted emails</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lead.extractedEmails.length ? (
                lead.extractedEmails.map((email) => (
                  <div key={email.id} className="rounded-md border bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{email.email}</span>
                      <Badge variant={email.status === "MX_FOUND" ? "success" : "secondary"}>{email.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{email.sourceUrl}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No extracted email records yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opportunity summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6">{lead.opportunitySummary ?? "No summary generated yet."}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outreach draft</CardTitle>
        </CardHeader>
        <CardContent>
          <OutreachDraftCard leadId={lead.id} draft={draft} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes and status</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadNotesCard leadId={lead.id} notes={lead.notes} outreachStatus={lead.outreachStatus} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raw OSM tags</CardTitle>
        </CardHeader>
        <CardContent>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-primary">Show structured OSM metadata</summary>
            <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(lead.rawOsmTags ?? {}, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value, linkHref, copy }: { label: string; value?: string | null; linkHref?: string | null; copy?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      {value ? (
        <div className="flex items-center gap-1">
        {linkHref ? (
          <SafeLink href={linkHref} external className="break-words text-primary hover:underline">
            {value}
          </SafeLink>
        ) : (
          <p className="break-words">{value}</p>
        )
        }
        {copy ? <CopyButton value={value} label={`Copy ${label}`} /> : null}
        </div>
      ) : (
        <p className="text-muted-foreground">Not found</p>
      )}
    </div>
  );
}

function osmSourceUrl(sourceType?: string | null, sourceId?: string | null) {
  if (!sourceType || !sourceId) return null;
  const id = sourceId.split("/").pop();
  if (!id || !["node", "way", "relation"].includes(sourceType)) return null;
  return `https://www.openstreetmap.org/${sourceType}/${id}`;
}
