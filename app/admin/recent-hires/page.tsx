export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { parseApplicationRow } from "@/lib/types/database";
import { RecentHiresTable, type RecentHireRow } from "@/components/admin/RecentHiresTable";

interface OfferLite {
  applicationId: string;
  signedAt: string | null;
  startDate: string | null;
}

interface SlackLite {
  applicationId: string;
  inviteEmailSentAt: string | null;
  joinedAt: string | null;
  welcomeDmSentAt: string | null;
}

async function getRecentHires(): Promise<RecentHireRow[]> {
  const [appsResult, offersResult, slackResult] = await Promise.all([
    supabase
      .from("applications")
      .select("*, job:jobs(*)")
      .eq("status", "ONBOARDED")
      .order("updatedAt", { ascending: false })
      .limit(50),
    supabase
      .from("offers")
      .select("applicationId, signedAt, startDate")
      .eq("status", "SIGNED"),
    supabase
      .from("slack_onboardings")
      .select("applicationId, inviteEmailSentAt, joinedAt, welcomeDmSentAt"),
  ]);

  const applications = (appsResult.data ?? []).map((row) =>
    parseApplicationRow(row as Record<string, unknown>)
  );
  const offers = (offersResult.data ?? []) as OfferLite[];
  const slack = (slackResult.data ?? []) as SlackLite[];

  const offerByApp = new Map<string, OfferLite>();
  for (const o of offers) offerByApp.set(o.applicationId, o);
  const slackByApp = new Map<string, SlackLite>();
  for (const s of slack) slackByApp.set(s.applicationId, s);

  return applications.map((a): RecentHireRow => {
    const offer = offerByApp.get(a.id);
    const s = slackByApp.get(a.id);
    let slackStatus: RecentHireRow["slackStatus"] = "pending";
    if (s?.welcomeDmSentAt) slackStatus = "welcomed";
    else if (s?.joinedAt) slackStatus = "joined";
    else if (s?.inviteEmailSentAt) slackStatus = "invited";

    return {
      applicationId: a.id,
      candidateName: a.candidateName,
      candidateEmail: a.candidateEmail,
      jobTitle: a.job!.title,
      signedAt: offer?.signedAt ?? null,
      startDate: offer?.startDate ?? null,
      slackStatus,
    };
  });
}

export default async function RecentHiresPage() {
  const rows = await getRecentHires();

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recent hires</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} onboarded candidate{rows.length !== 1 ? "s" : ""}.
        </p>
      </div>

      <RecentHiresTable rows={rows} />
    </main>
  );
}
