export const SCORE_LABELS = [
  { min: 80, label: "Hot", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { min: 60, label: "Good", className: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { min: 40, label: "Medium", className: "bg-amber-100 text-amber-900 border-amber-200" },
  { min: 0, label: "Low", className: "bg-slate-100 text-slate-700 border-slate-200" }
] as const;

export function getLeadQuality(score: number) {
  return SCORE_LABELS.find((label) => score >= label.min) ?? SCORE_LABELS[3];
}
