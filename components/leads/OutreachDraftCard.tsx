"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Draft = {
  id: string;
  subject: string;
  body: string;
  templateKey: string;
};

export function OutreachDraftCard({ leadId, draft }: { leadId: string; draft?: Draft | null }) {
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [templateKey, setTemplateKey] = useState(draft?.templateKey ?? "generic_local_business");
  const [draftId, setDraftId] = useState(draft?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function regenerate() {
    setBusy("regenerate");
    const response = await fetch(`/api/leads/${leadId}/generate-draft`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data?.error ?? "Draft could not be regenerated.");
      setBusy(null);
      return;
    }
    setDraftId(data.draft.id);
    setSubject(data.draft.subject);
    setBody(data.draft.body);
    setTemplateKey(data.draft.templateKey);
    setMessage("Draft regenerated.");
    setBusy(null);
  }

  async function save() {
    if (!draftId) return regenerate();
    setBusy("save");
    const response = await fetch(`/api/outreach-drafts/${draftId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, body, templateKey })
    });
    const data = await response.json().catch(() => null);
    setMessage(response.ok ? "Draft saved." : data?.error ?? "Draft could not be saved.");
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">Template: {templateKey.replace(/_/g, " ")}</p>
        <div className="space-y-2">
          <Label htmlFor="draft-subject">Subject</Label>
          <Input id="draft-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="draft-body">Body</Label>
          <Textarea
            id="draft-body"
            value={body}
            maxLength={5000}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-72 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">{body.length}/5000 characters</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save} disabled={Boolean(busy)}>
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Save draft
        </Button>
        <Button type="button" variant="outline" onClick={regenerate} disabled={Boolean(busy)}>
          {busy === "regenerate" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Regenerate
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
