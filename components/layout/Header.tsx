import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/src/server/auth/session";
import { MobileNav } from "@/components/layout/MobileNav";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export async function Header() {
  const session = await getSession();
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <div>
          <p className="text-sm font-semibold">OpenLead Scout</p>
          <p className="text-xs text-muted-foreground">Data from OpenStreetMap contributors.</p>
        </div>
      </div>
      {session ? (
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{session.email}</span>
          <ThemeToggle />
          <form action="/api/auth/logout" method="post">
            <Button variant="outline" size="sm" type="submit" title="Sign out">
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      ) : null}
    </header>
  );
}
