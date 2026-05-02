"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SettingsForm({ values }: { values: Record<string, string> }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(response.ok ? "Settings saved." : "Settings could not be saved.");
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2">
      <Field label="Sender name">
        <Input name="senderName" defaultValue={values.senderName ?? ""} />
      </Field>
      <Field label="Sender company">
        <Input name="senderCompany" defaultValue={values.senderCompany ?? ""} />
      </Field>
      <Field label="User-Agent contact email">
        <Input name="userAgentContactEmail" type="email" defaultValue={values.userAgentContactEmail ?? ""} placeholder="contact@example.com" />
      </Field>
      <Field label="Default batch size">
        <Input name="defaultBatchSize" type="number" min={1} max={10} defaultValue={values.defaultBatchSize ?? "5"} />
      </Field>
      <Field label="Default radius">
        <Input name="defaultRadius" type="number" min={500} max={20000} step={500} defaultValue={values.defaultRadius ?? "5000"} />
      </Field>
      <Field label="Attribution text">
        <Input name="attributionText" defaultValue={values.attributionText ?? "Data from OpenStreetMap contributors."} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Sender service">
          <Textarea name="senderService" defaultValue={values.senderService ?? ""} />
        </Field>
      </div>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Save settings
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
