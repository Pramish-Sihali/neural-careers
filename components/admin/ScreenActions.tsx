"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationStatus } from "@/lib/types/database";
import { SlotPickerModal } from "./SlotPickerModal";

interface Props {
  applicationId: string;
  candidateName: string;
  currentStatus: ApplicationStatus;
}

export function ScreenActions({ applicationId, candidateName, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSlotPicker, setShowSlotPicker] = useState(false);

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

  async function callAction(endpoint: string, method: "POST" | "PATCH", body?: object) {
    setLoading(endpoint);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminSecret}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Action failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">Actions</p>
        <div className="flex flex-wrap gap-2">
          {currentStatus === "APPLIED" && (
            <button
              onClick={() => callAction(`/api/admin/applications/${applicationId}/screen`, "POST")}
              disabled={loading !== null}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading === `/api/admin/applications/${applicationId}/screen` ? "Screening…" : "Run AI Screen"}
            </button>
          )}
          {currentStatus === "SCREENED" && (
            <>
              <button
                onClick={() => callAction(`/api/admin/applications/${applicationId}/shortlist`, "POST")}
                disabled={loading !== null}
                className="rounded-md bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
              >
                Shortlist
              </button>
              <button
                onClick={() => callAction(`/api/admin/applications/${applicationId}/status`, "PATCH", { status: "REJECTED" })}
                disabled={loading !== null}
                className="rounded-md border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          {currentStatus === "SHORTLISTED" && (
            <button
              onClick={() => setShowSlotPicker(true)}
              disabled={loading !== null}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              Offer Interview Slots
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {showSlotPicker && (
        <SlotPickerModal
          applicationId={applicationId}
          candidateName={candidateName}
          onClose={() => setShowSlotPicker(false)}
          onOffered={() => {
            setShowSlotPicker(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
