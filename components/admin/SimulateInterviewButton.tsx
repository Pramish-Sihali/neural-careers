// components/admin/SimulateInterviewButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  applicationId: string;
}

export function SimulateInterviewButton({ applicationId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSimulate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/applications/${applicationId}/simulate-interview`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET ?? ""}`,
          },
        }
      );

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to simulate interview");
      }

      // Re-render server component — correct Next.js App Router pattern
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleSimulate}
        disabled={loading}
        variant="outline"
        size="sm"
      >
        {loading ? "Processing..." : "Simulate Interview Complete"}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
