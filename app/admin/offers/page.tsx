export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import {
  OfferedCandidatesTable,
  type OfferedCandidateRow,
} from "@/components/admin/OfferedCandidatesTable";
import type { OfferStatus } from "@/lib/types/database";

interface OfferRow {
  id: string;
  status: OfferStatus;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
  jobTitle: string;
  application: { candidateName: string } | { candidateName: string }[] | null;
}

async function getOfferedCandidates(): Promise<OfferedCandidateRow[]> {
  const { data } = await supabase
    .from("offers")
    .select("id, status, sentAt, signedAt, createdAt, jobTitle, application:applications(candidateName)")
    .order("createdAt", { ascending: false });

  const rows = (data ?? []) as unknown as OfferRow[];
  return rows.map((r): OfferedCandidateRow => {
    const app = Array.isArray(r.application) ? r.application[0] : r.application;
    return {
      offerId: r.id,
      candidateName: app?.candidateName ?? "Unknown candidate",
      jobTitle: r.jobTitle,
      status: r.status,
      sentAt: r.sentAt,
      signedAt: r.signedAt,
      createdAt: r.createdAt,
    };
  });
}

export default async function OffersListPage() {
  const rows = await getOfferedCandidates();

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Offers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} offer{rows.length !== 1 ? "s" : ""} across all candidates.
        </p>
      </div>

      <OfferedCandidatesTable rows={rows} />
    </main>
  );
}
