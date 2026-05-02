"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, FileText, Gauge, Loader2, Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProcessType = "ENRICH_LEAD_WEBSITE" | "SCORE_LEAD" | "GENERATE_OUTREACH_DRAFT" | "GEOCODE_CAMPAIGN" | "COLLECT_OSM_LEADS";

export function CampaignStatusCard({ campaignId, defaultBatchSize = 5 }: { campaignId: string; defaultBatchSize?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function collect() {
    setBusy("collect");
    setMessage(null);
    const collectResponse = await fetch(`/api/campaigns/${campaignId}/collect`, { method: "POST" });
    if (!collectResponse.ok) {
      setMessage("Collect request failed.");
      setBusy(null);
      return;
    }
    try {
      const result = await process(["GEOCODE_CAMPAIGN", "COLLECT_OSM_LEADS"], 2);
      setMessage(`Collection batch processed ${result.processed} job(s), ${result.remaining} ready job(s) remain.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Collection processing failed.");
    }
    setBusy(null);
    router.refresh();
  }

  async function process(types: ProcessType[], limit: number) {
    const response = await fetch("/api/jobs/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ types, limit })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error ?? "Batch processing failed");
    return data;
  }

  async function run(label: string, types: ProcessType[], limit: number) {
    setBusy(label);
    setMessage(null);
    try {
      const result = await process(types, limit);
      setMessage(`${label} processed ${result.processed} job(s), failed ${result.failed}, ${result.remaining} ready job(s) remain.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Batch processing failed.");
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual processing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <ActionButton busy={busy === "collect"} onClick={collect} icon={Search} label="Collect leads" />
          <ActionButton busy={busy === "Enrichment"} onClick={() => run("Enrichment", ["ENRICH_LEAD_WEBSITE"], defaultBatchSize)} icon={Play} label="Process enrichment" />
          <ActionButton busy={busy === "Scoring"} onClick={() => run("Scoring", ["SCORE_LEAD"], 10)} icon={Gauge} label="Score leads" />
          <ActionButton busy={busy === "Drafts"} onClick={() => run("Drafts", ["GENERATE_OUTREACH_DRAFT"], 10)} icon={FileText} label="Generate drafts" />
          <Button variant="outline" type="button" onClick={() => window.location.assign(`/api/exports/csv?campaignId=${campaignId}`)}>
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        </div>
        {message ? <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" aria-live="polite">{message}</p> : null}
      </CardContent>
    </Card>
  );
}

function ActionButton({
  busy,
  onClick,
  icon: Icon,
  label
}: {
  busy: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
}) {
  return (
    <Button variant="outline" type="button" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
      {label}
    </Button>
  );
}
