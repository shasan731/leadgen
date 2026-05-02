import { AlertCircle, CheckCircle2 } from "lucide-react";

export function WebsiteIssuesList({ issuesJson }: { issuesJson: unknown }) {
  const issues = normalizeIssues(issuesJson);
  if (!issues.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        No issues recorded.
      </div>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {issues.map((issue) => (
        <li key={issue.key} className="flex items-start gap-2 rounded-md border bg-white p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden />
          <div>
            <p className="font-medium">{issue.label}</p>
            <p className="text-xs text-muted-foreground">{issue.key}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function normalizeIssues(issuesJson: unknown) {
  if (!Array.isArray(issuesJson)) return [];
  return issuesJson.map((issue) => {
    if (typeof issue === "string") return { key: issue, label: issue.replace(/_/g, " ") };
    if (issue && typeof issue === "object" && "key" in issue) {
      const key = String(issue.key);
      const label = "label" in issue ? String(issue.label) : key.replace(/_/g, " ");
      return { key, label };
    }
    return { key: String(issue), label: String(issue) };
  });
}
