"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type ActivityStatus =
  | "Awaiting confirmation"
  | "Scheduled"
  | "Awaiting notes"
  | "Offer sent"
  | "Offer signed"
  | "Onboarded";

export interface ActivityRow {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  time: string | null;
  status: ActivityStatus;
}

const STATUS_STYLES: Record<ActivityStatus, string> = {
  "Awaiting confirmation":
    "bg-yellow-100 text-yellow-800 border-yellow-200",
  Scheduled: "bg-blue-50 text-blue-800 border-blue-200",
  "Awaiting notes": "bg-amber-50 text-amber-800 border-amber-200",
  "Offer sent": "bg-purple-50 text-purple-800 border-purple-200",
  "Offer signed": "bg-green-50 text-green-800 border-green-200",
  Onboarded: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface Props {
  rows: ActivityRow[];
  /** Auto-refresh the feed every N ms by calling router.refresh(). */
  refreshIntervalMs?: number;
}

export function InterviewActivityTable({ rows, refreshIntervalMs = 30_000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!refreshIntervalMs) return;
    const id = setInterval(() => router.refresh(), refreshIntervalMs);
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, refreshIntervalMs]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        No interview activity yet. Offer a slot on a shortlisted candidate to see it here.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[36%]" />
          <col className="w-[26%]" />
          <col className="w-[22%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Candidate</th>
            <th className="px-4 py-2.5 font-medium">Role</th>
            <th className="px-4 py-2.5 font-medium">Time</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.applicationId}
              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-2.5 truncate">
                <Link
                  href={`/admin/applications/${r.applicationId}`}
                  className="font-medium text-foreground hover:underline"
                  title={r.candidateName}
                >
                  {r.candidateName}
                </Link>
              </td>
              <td className="px-4 py-2.5 truncate text-muted-foreground" title={r.jobTitle}>
                {r.jobTitle}
              </td>
              <td className="px-4 py-2.5 truncate text-muted-foreground" title={fmtTime(r.time)}>
                {fmtTime(r.time)}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                    STATUS_STYLES[r.status]
                  )}
                >
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
