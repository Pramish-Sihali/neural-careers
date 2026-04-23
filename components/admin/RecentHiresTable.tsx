"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface RecentHireRow {
  applicationId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  signedAt: string | null;
  startDate: string | null;
  slackStatus: "invited" | "joined" | "welcomed" | "pending";
}

const SLACK_LABEL: Record<RecentHireRow["slackStatus"], string> = {
  pending: "Not invited",
  invited: "Invite sent",
  joined: "Joined",
  welcomed: "Welcomed",
};

const SLACK_STYLES: Record<RecentHireRow["slackStatus"], string> = {
  pending: "bg-muted text-muted-foreground border border-border",
  invited: "bg-blue-50 text-blue-700 border border-blue-200",
  joined: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  welcomed: "bg-green-50 text-green-700 border border-green-200",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecentHiresTable({ rows }: { rows: RecentHireRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        No onboarded candidates yet. Once an offer is signed and the new hire
        joins Slack, they&apos;ll appear here.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[24%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Role</th>
            <th className="px-4 py-2.5 font-medium">Signed</th>
            <th className="px-4 py-2.5 font-medium">Start date</th>
            <th className="px-4 py-2.5 font-medium">Slack</th>
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
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={r.candidateEmail}
                >
                  {r.candidateEmail}
                </p>
              </td>
              <td
                className="px-4 py-2.5 truncate text-muted-foreground"
                title={r.jobTitle}
              >
                {r.jobTitle}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {fmtDate(r.signedAt)}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {fmtDate(r.startDate)}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                    SLACK_STYLES[r.slackStatus]
                  )}
                >
                  {SLACK_LABEL[r.slackStatus]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
