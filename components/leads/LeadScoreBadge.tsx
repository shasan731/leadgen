import { Badge } from "@/components/ui/badge";
import { getLeadQuality } from "@/src/shared/constants/scoring";

export function LeadScoreBadge({ score }: { score: number }) {
  const quality = getLeadQuality(score);
  return (
    <div className="flex items-center gap-2">
      <Badge className={quality.className}>{quality.label}</Badge>
      <span className="text-sm font-semibold tabular-nums">{score}</span>
    </div>
  );
}
