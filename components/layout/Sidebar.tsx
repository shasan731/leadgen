"use client";

import Link from "next/link";
import { BarChart3, Download, LayoutDashboard, ListChecks, Map, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/src/server/utils/cn";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Map },
  { href: "/leads", label: "Leads", icon: ListChecks },
  { href: "/exports", label: "Exports", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-white md:block">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <BarChart3 className="h-6 w-6 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-semibold">OpenLead Scout</p>
          <p className="text-xs text-muted-foreground">Rule-based lead finder</p>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-muted hover:text-slate-950",
              (pathname === item.href || pathname.startsWith(`${item.href}/`)) && "bg-muted text-slate-950"
            )}
          >
            <item.icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
