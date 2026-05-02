import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you opened does not exist.</p>
      <Link href="/dashboard" className={buttonVariants()}>
        Go to dashboard
      </Link>
    </div>
  );
}
