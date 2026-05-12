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
  const [showManual, setShowManual] = useState(false);

  async function processEverything() {
    setBusy("Everything");
    setMessage(null);
    try {
      // First ensure collection jobs are there if needed
      await fetch(`/api/campaigns/${campaignId}/collect`, { method: "POST" });

      // Process a mix of all job types
      const result = await process([
        "GEOCODE_CAMPAIGN",
        "COLLECT_OSM_LEADS",
        "ENRICH_LEAD_WEBSITE",
        "SCORE_LEAD",
        "GENERATE_OUTREACH_DRAFT"
      ], defaultBatchSize * 2);

      setMessage(`Batch processed ${result.processed} job(s). ${result.remaining} ready job(s) remain.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Processing failed.");
    }
    setBusy(null);
    router.refresh();
  }

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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Campaign actions</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setShowManual(!showManual)}>
          {showManual ? "Hide manual tools" : "Show manual tools"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <Button
            className="h-12 px-8"
            disabled={Boolean(busy)}
            onClick={processEverything}
          >
            {busy === "Everything" ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Play className="mr-2 h-5 w-5" />
            )}
            Process next batch
          </Button>

          <Button
            variant="outline"
            className="h-12 px-8"
            onClick={() => window.location.assign(`/api/exports/csv?campaignId=${campaignId}`)}
          >
            <Download className="mr-2 h-5 w-5" />
            Download CSV
          </Button>
        </div>

        {showManual && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manual override tools</p>
            <div className="flex flex-wrap gap-2">
              <ActionButton busy={busy === "collect"} onClick={collect} icon={Search} label="Collect leads" />
              <ActionButton busy={busy === "Enrichment"} onClick={() => run("Enrichment", ["ENRICH_LEAD_WEBSITE"], defaultBatchSize)} icon={Play} label="Process enrichment" />
              <ActionButton busy={busy === "Scoring"} onClick={() => run("Scoring", ["SCORE_LEAD"], 10)} icon={Gauge} label="Score leads" />
              <ActionButton busy={busy === "Drafts"} onClick={() => run("Drafts", ["GENERATE_OUTREACH_DRAFT"], 10)} icon={FileText} label="Generate drafts" />
            </div>
          </div>
        )}

        {message ? (
          <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800 border border-blue-100" aria-live="polite">
            {message}
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Click <strong>Process next batch</strong> to automatically collect, enrich, score, and draft leads in this campaign.
        </p>
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
