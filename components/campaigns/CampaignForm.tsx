"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BUSINESS_CATEGORIES, SERVICE_OFFERS } from "@/src/shared/constants/categories";
import { campaignCreateSchema, type CampaignCreateInput } from "@/src/shared/schemas/campaign.schema";

export function CampaignForm({
  defaults = {}
}: {
  defaults?: Partial<Pick<CampaignCreateInput, "radiusMeters" | "senderName" | "senderCompany" | "senderService">>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CampaignCreateInput>({
    resolver: zodResolver(campaignCreateSchema),
    defaultValues: {
      name: "",
      businessType: "Restaurant",
      osmCategoryKey: "restaurant",
      locationQuery: "",
      radiusMeters: defaults.radiusMeters ?? 5000,
      maxLeads: 50,
      serviceOffer: "website_creation",
      senderName: defaults.senderName ?? "",
      senderCompany: defaults.senderCompany ?? "",
      senderService: defaults.senderService ?? ""
    }
  });

  async function onSubmit(values: CampaignCreateInput) {
    setError(null);
    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values)
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Campaign could not be created");
      return;
    }
    const body = await response.json();
    router.push(`/campaigns/${body.campaign.id}`);
    router.refresh();
  }

  const selectedCategory = useWatch({ control: form.control, name: "osmCategoryKey" });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-2">
      <Field label="Campaign name" error={form.formState.errors.name?.message}>
        <Input placeholder="Mirpur restaurant website leads" {...form.register("name")} />
      </Field>

      <Field label="Business category" error={form.formState.errors.osmCategoryKey?.message}>
        <Select
          {...form.register("osmCategoryKey")}
          onChange={(event) => {
            const category = BUSINESS_CATEGORIES.find((item) => item.value === event.target.value);
            form.setValue("osmCategoryKey", event.target.value);
            form.setValue("businessType", category?.label ?? event.target.value);
          }}
          value={selectedCategory}
        >
          {BUSINESS_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Location" error={form.formState.errors.locationQuery?.message}>
        <Input placeholder="Mirpur, Dhaka" {...form.register("locationQuery")} />
      </Field>

      <Field label="Service offer" error={form.formState.errors.serviceOffer?.message}>
        <Select {...form.register("serviceOffer")}>
          {SERVICE_OFFERS.map((offer) => (
            <option key={offer.value} value={offer.value}>
              {offer.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Radius meters" error={form.formState.errors.radiusMeters?.message}>
        <Input type="number" min={500} max={20000} step={500} {...form.register("radiusMeters", { valueAsNumber: true })} />
      </Field>

      <Field label="Max leads" error={form.formState.errors.maxLeads?.message}>
        <Input type="number" min={1} max={200} {...form.register("maxLeads", { valueAsNumber: true })} />
      </Field>

      <Field label="Sender name" error={form.formState.errors.senderName?.message}>
        <Input placeholder="Your name" {...form.register("senderName")} />
      </Field>

      <Field label="Sender company" error={form.formState.errors.senderCompany?.message}>
        <Input placeholder="Your company" {...form.register("senderCompany")} />
      </Field>

      <div className="lg:col-span-2">
        <Field label="Sender service description" error={form.formState.errors.senderService?.message}>
          <Textarea placeholder="Website, SEO, and lead capture setup for local businesses" {...form.register("senderService")} />
        </Field>
      </div>

      {error ? <p className="text-sm text-destructive lg:col-span-2">{error}</p> : null}

      <div className="lg:col-span-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Create campaign
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
