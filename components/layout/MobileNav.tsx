"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/leads", label: "Leads" },
  { href: "/exports", label: "Exports" },
  { href: "/settings", label: "Settings" }
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} title="Open navigation">
        <Menu className="h-5 w-5" aria-hidden />
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/30" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <nav className="relative h-full w-72 bg-white p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">OpenLead Scout</p>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} title="Close navigation">
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            <div className="space-y-1">
              {items.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
