import * as React from "react";
import { cn } from "@/src/server/utils/cn";

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive", className)} {...props} />;
}
