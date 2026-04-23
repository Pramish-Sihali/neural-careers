"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Placeholder for an upcoming "Create new job" wizard. Shows a toast-style
 * alert on click so the button communicates intent without doing anything
 * destructive — the real wizard is future work and would live at
 * /admin/jobs/new.
 */
export function CreateJobButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        alert("Create new job — wizard lands in a follow-up commit.");
      }}
      className="gap-1.5"
    >
      <Plus className="h-4 w-4" />
      Create new job
    </Button>
  );
}
