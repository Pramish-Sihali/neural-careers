"use client";

import Link from "next/link";
import type { OfferStatus } from "@/lib/types/database";

export interface OfferedCandidateRow {
  offerId: string;
  candidateName: string;
  jobTitle: string;
  status: OfferStatus;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<OfferStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
  SENT: "bg-blue-50 text-blue-700 border-blue-200",
  SIGNED: "bg-green-50 text-green-700 border-green-200",
  DECLINED: "bg-red-50 text-red-700 border-red-200",
  EXPIRED: "bg-zinc-50 text-zinc-500 border-zinc-200",
  VOIDED: "bg-red-50 text-red-700 border-red-200",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function OfferedCandidatesTable({ rows }: { rows: OfferedCandidateRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        No offers yet. Generate one from a candidate&apos;s detail page.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[28%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Candidate</th>
            <th className="px-4 py-2.5 font-medium">Role</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Sent</th>
            <th className="px-4 py-2.5 font-medium">Signed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.offerId}
              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-2.5 truncate">
                <Link
                  href={`/admin/offers/${r.offerId}`}
                  className="font-medium text-foreground hover:underline"
                  title={r.candidateName}
                >
                  {r.candidateName}
                </Link>
              </td>
              <td
                className="px-4 py-2.5 truncate text-muted-foreground"
                title={r.jobTitle}
              >
                {r.jobTitle}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[r.status]}`}
                >
                  {r.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {fmtDate(r.sentAt)}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {fmtDate(r.signedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
