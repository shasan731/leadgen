import { AlertTriangle, BriefcaseBusiness, CheckCircle2, Clock, Mail, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Stats = {
  totalCampaigns: number;
  totalLeads: number;
  leadsWithEmail: number;
  highScoreLeads: number;
  pendingJobs: number;
  failedJobs: number;
};

const statMeta = [
  { key: "totalCampaigns", label: "Total campaigns", icon: BriefcaseBusiness },
  { key: "totalLeads", label: "Total leads", icon: Target },
  { key: "leadsWithEmail", label: "Leads with email", icon: Mail },
  { key: "highScoreLeads", label: "High-score leads", icon: CheckCircle2 },
  { key: "pendingJobs", label: "Pending jobs", icon: Clock },
  { key: "failedJobs", label: "Failed jobs", icon: AlertTriangle }
] as const;

export function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {statMeta.map((item) => (
        <Card key={item.key}>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
            <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats[item.key].toLocaleString()}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
