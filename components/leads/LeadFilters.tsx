import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type CampaignOption = {
  id: string;
  name: string;
};

export function LeadFilters({
  campaigns,
  defaults
}: {
  campaigns: CampaignOption[];
  defaults: Record<string, string | undefined>;
}) {
  return (
    <form className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4 xl:grid-cols-8">
      <Field label="Campaign">
        <Select name="campaignId" defaultValue={defaults.campaignId ?? ""}>
          <option value="">All campaigns</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Search">
        <Input name="search" defaultValue={defaults.search ?? ""} placeholder="Name, email, phone" />
      </Field>
      <Field label="Minimum score">
        <Input name="minScore" type="number" min={0} max={100} defaultValue={defaults.minScore ?? ""} />
      </Field>
      <Field label="Has email">
        <Select name="hasEmail" defaultValue={defaults.hasEmail ?? ""}>
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      </Field>
      <Field label="Has phone">
        <Select name="hasPhone" defaultValue={defaults.hasPhone ?? ""}>
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      </Field>
      <Field label="Has website">
        <Select name="hasWebsite" defaultValue={defaults.hasWebsite ?? ""}>
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      </Field>
      <Field label="Email status">
        <Select name="emailStatus" defaultValue={defaults.emailStatus ?? ""}>
          <option value="">Any</option>
          {["UNKNOWN", "INVALID_FORMAT", "VALID_FORMAT", "DOMAIN_FOUND", "MX_FOUND", "NO_MX", "DISPOSABLE", "RISKY"].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Quality">
        <Select name="quality" defaultValue={defaults.quality ?? ""}>
          <option value="">Any</option>
          {["Hot", "Good", "Medium", "Low"].map((quality) => (
            <option key={quality} value={quality}>
              {quality}
            </option>
          ))}
        </Select>
      </Field>
      <div className="md:col-span-4 xl:col-span-8">
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" aria-hidden />
          Apply filters
        </Button>
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
