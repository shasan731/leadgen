"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const OUTREACH_STATUSES = ["NOT_STARTED", "DRAFT_CREATED", "APPROVED", "EXPORTED", "CONTACTED", "REPLIED", "NOT_INTERESTED"];

export function LeadNotesCard({ leadId, notes, outreachStatus }: { leadId: string; notes?: string | null; outreachStatus: string }) {
  const [draftNotes, setDraftNotes] = useState(notes ?? "");
  const [status, setStatus] = useState(outreachStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notes: draftNotes, outreachStatus: status })
    });
    setMessage(response.ok ? "Lead updated." : "Lead update failed.");
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Outreach status</Label>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          {OUTREACH_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} maxLength={2000} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Save lead
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
