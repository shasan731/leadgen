import { Search, LucideIcon } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon: Icon = Search,
  action
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-white p-8 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
