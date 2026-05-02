"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeleteButton({ endpoint, redirectTo, label = "Delete" }: { endpoint: string; redirectTo: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm(`Are you sure you want to ${label.toLowerCase()}?`)) return;
    setBusy(true);
    const response = await fetch(endpoint, { method: "DELETE" });
    setBusy(false);
    if (response.ok) {
      router.push(redirectTo);
      router.refresh();
    } else {
      window.alert("Delete failed.");
    }
  }
  return (
    <Button type="button" variant="destructive" onClick={remove} disabled={busy}>
      <Trash2 className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}
